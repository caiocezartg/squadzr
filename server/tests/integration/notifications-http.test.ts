import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { userNotificationSchema, type UserNotificationDto } from '@squadzr/schemas'
import { signIn, type TestUser } from '@test/harness/auth'
import { DISCORD_INVITE, createRoom, get, insertGame, joinAll } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// Characterizes the in-app notification API, fed by the Room Ready flow that
// runs when the last seat of a room is taken over HTTP.

let server: TestServer
let host: TestUser
let member: TestUser

beforeEach(async () => {
  server = await buildTestServer()
  host = await signIn(server, 'Host')
  member = await signIn(server, 'Member')
})

afterEach(async () => {
  await server.close()
})

const UNAUTHORIZED = { error: 'UNAUTHORIZED', message: 'Authentication required' }
// Transport dates are ISO 8601 UTC strings, as produced by `Date.prototype.toISOString()`.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** Fills a 2-seat room with `host` and `member`, which triggers Room Ready notifications. */
async function fillRoom(name = 'Ready squad') {
  const game = await insertGame(server)
  const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 2, name })
  await joinAll(server, room.code, [member])
  return { room, game }
}

async function listNotifications(user: TestUser, query = ''): Promise<UserNotificationDto[]> {
  const response = await get(server, `/api/notifications${query}`, user)
  expect(response.statusCode, response.body).toBe(200)
  return response
    .json<{ notifications: unknown[] }>()
    .notifications.map((notification) => userNotificationSchema.parse(notification))
}

function post(user: TestUser | null, url: string) {
  return server.app.inject({ method: 'POST', url, headers: user?.headers })
}

function remove(user: TestUser | null, url: string) {
  return server.app.inject({ method: 'DELETE', url, headers: user?.headers })
}

describe('Room Ready notifications', () => {
  it('creates one unread room_ready notification per member when the room fills', async () => {
    const { room, game } = await fillRoom()

    for (const user of [host, member]) {
      const [notification, ...rest] = await listNotifications(user)
      expect(rest).toEqual([])
      expect(notification).toMatchObject({
        userId: user.id,
        type: 'room_ready',
        title: 'Room ready: your squad is full',
        message: 'Ready squad is ready. Your Discord invite is now available.',
        readAt: null,
        payload: {
          roomId: room.id,
          roomCode: room.code,
          roomName: 'Ready squad',
          gameName: game.name,
          discordLink: DISCORD_INVITE,
        },
      })
      expect(notification?.payload.players).toEqual(
        expect.arrayContaining([
          { name: host.name, image: host.image },
          { name: member.name, image: member.image },
        ])
      )
    }
  })

  it('does not notify anyone while the room still has free seats', async () => {
    const game = await insertGame(server)
    const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 3 })
    await joinAll(server, room.code, [member])

    expect(await listNotifications(host)).toEqual([])
    expect(await listNotifications(member)).toEqual([])
  })
})

describe('GET /api/notifications', () => {
  it('lists newest first and honours the limit query', async () => {
    await fillRoom('First squad')
    await fillRoom('Second squad')

    const all = await listNotifications(host)
    const limited = await listNotifications(host, '?limit=1')

    expect(all.map((n) => n.payload.roomName)).toEqual(['Second squad', 'First squad'])
    expect(limited.map((n) => n.payload.roomName)).toEqual(['Second squad'])
  })

  it.each(['?limit=0', '?limit=51', '?limit=abc'])(
    'rejects %s with 400 VALIDATION_ERROR',
    async (query) => {
      const response = await get(server, `/api/notifications${query}`, host)

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({
        error: 'VALIDATION_ERROR',
        message: expect.stringMatching(/^querystring\/limit /),
      })
    }
  )

  it('requires authentication', async () => {
    const response = await get(server, '/api/notifications')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual(UNAUTHORIZED)
  })
})

describe('POST /api/notifications/:id/read', () => {
  it('marks the caller notification as read once', async () => {
    await fillRoom()
    const [notification] = await listNotifications(member)

    const first = await post(member, `/api/notifications/${notification!.id}/read`)
    const second = await post(member, `/api/notifications/${notification!.id}/read`)

    expect(first.json()).toEqual({ success: true })
    expect(second.statusCode).toBe(200)
    expect(second.json()).toEqual({ success: false })
    expect((await listNotifications(member))[0]?.readAt).toMatch(ISO_DATE_TIME)
  })

  it("answers success: false for another user's notification and leaves it unread", async () => {
    await fillRoom()
    const [notification] = await listNotifications(member)

    const response = await post(host, `/api/notifications/${notification!.id}/read`)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: false })
    expect((await listNotifications(member))[0]?.readAt).toBeNull()
  })

  it('rejects a non-UUID id with 400 VALIDATION_ERROR', async () => {
    const response = await post(host, '/api/notifications/abc/read')

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'params/id Invalid UUID',
    })
  })

  it('requires authentication', async () => {
    const response = await post(null, `/api/notifications/${randomUUID()}/read`)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual(UNAUTHORIZED)
  })
})

describe('POST /api/notifications/read-all', () => {
  it("marks only the caller's unread notifications and reports how many", async () => {
    await fillRoom('First squad')
    await fillRoom('Second squad')

    const first = await post(host, '/api/notifications/read-all')
    const second = await post(host, '/api/notifications/read-all')

    expect(first.json()).toEqual({ success: true, count: 2 })
    expect(second.json()).toEqual({ success: true, count: 0 })
    expect((await listNotifications(member)).every((n) => n.readAt === null)).toBe(true)
  })

  it('requires authentication', async () => {
    const response = await post(null, '/api/notifications/read-all')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual(UNAUTHORIZED)
  })
})

describe('DELETE /api/notifications/:id', () => {
  it("deletes the caller's notification and refuses another user's", async () => {
    await fillRoom()
    const [notification] = await listNotifications(member)

    const foreign = await remove(host, `/api/notifications/${notification!.id}`)
    const own = await remove(member, `/api/notifications/${notification!.id}`)
    const again = await remove(member, `/api/notifications/${notification!.id}`)

    expect(foreign.json()).toEqual({ success: false })
    expect(own.json()).toEqual({ success: true })
    expect(again.json()).toEqual({ success: false })
    expect(await listNotifications(member)).toEqual([])
    expect(await listNotifications(host)).toHaveLength(1)
  })

  it('requires authentication', async () => {
    const response = await remove(null, `/api/notifications/${randomUUID()}`)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual(UNAUTHORIZED)
  })
})
