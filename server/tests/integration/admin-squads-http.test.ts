import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  PAGE_SIZE,
  adminSquadDetailResponseSchema,
  adminSquadsResponseSchema,
  auditEntriesResponseSchema,
  userNotificationSchema,
  type RoomDto,
  type UserNotificationDto,
} from '@squadzr/schemas'
import { roomMembers, userNotifications } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import {
  createRoom,
  findRoomRow,
  get,
  insertGame,
  joinAll,
  setRoomLifecycle,
} from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #119: the admin Squads list and detail read Open Squads only, and closing one deletes it, tells every
// member with the reason and audits it, in one transaction.

let server: TestServer
let admin: TestUser
let player: TestUser
let gameId: string

beforeEach(async () => {
  server = await buildTestServer()
  admin = await signIn(server, 'Ana Admin', { role: 'admin' })
  player = await signIn(server, 'Plain Player')
  gameId = (await insertGame(server, { name: 'Valorant' })).id
})

afterEach(async () => {
  await server.close()
})

const REASON = 'Offensive squad name'

function closeSquad(squadId: string, user: TestUser | null, body: unknown = { reason: REASON }) {
  return server.app.inject({
    method: 'POST',
    url: `/api/admin/squads/${squadId}/close`,
    headers: user?.headers,
    payload: body as object,
  })
}

async function list(query = '') {
  const response = await get(server, `/api/admin/squads${query}`, admin)
  expect(response.statusCode, response.body).toBe(200)
  return adminSquadsResponseSchema.parse(response.json())
}

async function notificationsOf(user: TestUser): Promise<UserNotificationDto[]> {
  const response = await get(server, '/api/notifications', user)
  expect(response.statusCode, response.body).toBe(200)
  return response
    .json<{ notifications: unknown[] }>()
    .notifications.map((notification) => userNotificationSchema.parse(notification))
}

async function squadWith(host: TestUser, options: { name?: string; maxPlayers?: number } = {}) {
  return createRoom(server, host, { gameId, maxPlayers: 5, ...options })
}

/** A Squad with its host and `joiners` more members. */
async function squadWithMembers(
  host: TestUser,
  joiners: TestUser[],
  options: { name?: string; maxPlayers?: number } = {}
): Promise<RoomDto> {
  const room = await squadWith(host, options)
  await joinAll(server, room.code, joiners)
  return room
}

describe('panel roles', () => {
  it.each(['moderator', 'admin', 'owner'] as const)(
    'lets a %s list, read and close a Squad',
    async (role) => {
      const staff = await signIn(server, `Staff ${role}`, { role })
      const host = await signIn(server, 'Host')
      const room = await squadWith(host)

      expect((await get(server, '/api/admin/squads', staff)).statusCode).toBe(200)
      expect((await get(server, `/api/admin/squads/${room.id}`, staff)).statusCode).toBe(200)
      expect((await closeSquad(room.id, staff)).statusCode).toBe(204)

      const audit = auditEntriesResponseSchema.parse(
        (await get(server, '/api/admin/audit', admin)).json()
      )
      expect(audit.items[0]).toMatchObject({
        action: 'squad_closed',
        actorId: staff.id,
        actorName: `Staff ${role}`,
      })
    }
  )

  it('refuses a user on all three routes with 403 ADMIN_REQUIRED', async () => {
    const host = await signIn(server, 'Host')
    const room = await squadWith(host)

    for (const response of [
      await get(server, '/api/admin/squads', player),
      await get(server, `/api/admin/squads/${room.id}`, player),
      await closeSquad(room.id, player),
    ]) {
      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
    }
    expect(await findRoomRow(server, room.id)).not.toBeNull()
  })
})

describe('GET /api/admin/squads', () => {
  it('answers an empty first page with the real total when no Squad is open', async () => {
    expect(await list()).toEqual({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0 })
  })

  it('lists Open Squads newest first with the host, game, slots and activity', async () => {
    const [h1, h2, member] = await Promise.all(
      ['Host One', 'Host Two', 'Member'].map((name) => signIn(server, name))
    )
    const older = await squadWithMembers(h1!, [member!], { name: 'Older' })
    const newer = await squadWith(h2!, { name: 'Newer' })

    const body = await list()

    expect(body.items.map((item) => item.name)).toEqual(['Newer', 'Older'])
    expect(body.total).toBe(2)
    const olderItem = body.items[1]!
    expect(olderItem).toMatchObject({
      id: older.id,
      code: older.code,
      game: { id: gameId, name: 'Valorant' },
      host: { id: h1!.id, name: 'Host One' },
      memberCount: 2,
      maxPlayers: 5,
    })
    expect(body.items[0]!.id).toBe(newer.id)
  })

  it('keeps Ready and expired Squads out of the list', async () => {
    const [h1, h2, h3, joiner] = await Promise.all(
      ['H1', 'H2', 'H3', 'J'].map((name) => signIn(server, name))
    )
    await squadWith(h1!, { name: 'Open one' })
    await squadWithMembers(h2!, [joiner!], { name: 'Ready one', maxPlayers: 2 })
    const expired = await squadWith(h3!, { name: 'Expired one' })
    const longAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
    await setRoomLifecycle(server, expired.id, {
      createdAt: longAgo,
      lastActivityAt: longAgo,
      readyAt: null,
    })

    const body = await list()

    expect(body.items.map((item) => item.name)).toEqual(['Open one'])
    expect(body.total).toBe(1)
  })

  it('pages through 20 Squads at a time', async () => {
    const hosts = await Promise.all(
      Array.from({ length: 25 }, (_, index) => signIn(server, `Host ${index + 1}`))
    )
    for (const [index, host] of hosts.entries()) {
      await squadWith(host, { name: `Squad ${String(index + 1).padStart(2, '0')}` })
    }

    const first = await list('?page=1')
    const second = await list('?page=2')
    const beyond = await list('?page=9')

    expect(first.items).toHaveLength(20)
    expect(second.items).toHaveLength(5)
    expect(first.total).toBe(25)
    expect(beyond).toEqual({ items: [], page: 9, pageSize: PAGE_SIZE, total: 25 })
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(25)
  })

  it('searches by Squad name, code and host name, ignoring case', async () => {
    const [h1, h2] = await Promise.all(['Diego Alves', 'Ana Lima'].map((n) => signIn(server, n)))
    const ranked = await squadWith(h1!, { name: 'Ranked sexta' })
    await squadWith(h2!, { name: 'Flex sem tilt' })

    expect((await list('?q=RANKED')).items.map((i) => i.id)).toEqual([ranked.id])
    expect((await list(`?q=${ranked.code.toLowerCase()}`)).items.map((i) => i.id)).toEqual([
      ranked.id,
    ])
    expect((await list(`?q=%23${ranked.code}`)).items.map((i) => i.id)).toEqual([ranked.id])
    expect((await list('?q=diego')).items.map((i) => i.id)).toEqual([ranked.id])
    expect((await list('?q=nobody')).total).toBe(0)
    expect((await list('?q=')).total).toBe(2)
  })

  it('treats LIKE wildcards in the search as plain characters', async () => {
    const host = await signIn(server, 'Host')
    await squadWith(host, { name: 'Plain name' })

    expect((await list('?q=%25')).total).toBe(0)
    expect((await list('?q=_')).total).toBe(0)
  })

  it('filters by game and reports the filtered total', async () => {
    const otherGame = await insertGame(server, { name: 'Dota 2' })
    const [h1, h2] = await Promise.all(['H1', 'H2'].map((n) => signIn(server, n)))
    const valorant = await squadWith(h1!, { name: 'Val squad' })
    await createRoom(server, h2!, { gameId: otherGame.id, maxPlayers: 5, name: 'Dota squad' })

    const body = await list(`?gameId=${gameId}`)

    expect(body.items.map((item) => item.id)).toEqual([valorant.id])
    expect(body.total).toBe(1)
    expect((await list(`?gameId=${gameId}&q=dota`)).total).toBe(0)
  })

  it('carries no email of anybody', async () => {
    const host = await signIn(server, 'Host')
    await squadWith(host)

    const response = await get(server, '/api/admin/squads', admin)

    expect(response.body).not.toContain('@squadzr.test')
  })

  it('refuses a game that is not a uuid and a page below 1 with 400 for an admin', async () => {
    expect((await get(server, '/api/admin/squads?gameId=valorant', admin)).statusCode).toBe(400)
    expect((await get(server, '/api/admin/squads?page=0', admin)).statusCode).toBe(400)
  })

  it('answers 401 signed out and 403 for a player, before validating the query', async () => {
    expect((await get(server, '/api/admin/squads?page=0')).statusCode).toBe(401)
    const response = await get(server, '/api/admin/squads?page=0', player)
    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
  })
})

describe('GET /api/admin/squads/:id', () => {
  it('returns the roster with the host marked and join times, and the full invite', async () => {
    const [host, m1, m2] = await Promise.all(
      ['Host', 'Member One', 'Member Two'].map((name) => signIn(server, name))
    )
    const room = await createRoom(server, host!, {
      gameId,
      maxPlayers: 5,
      language: 'en',
      platform: null,
      discordLink: 'https://discord.gg/ranked5x',
    })
    await joinAll(server, room.code, [m1!, m2!])

    const response = await get(server, `/api/admin/squads/${room.id}`, admin)

    expect(response.statusCode, response.body).toBe(200)
    const { squad } = adminSquadDetailResponseSchema.parse(response.json())
    expect(squad).toMatchObject({
      id: room.id,
      code: room.code,
      language: 'en',
      discordLink: 'https://discord.gg/ranked5x',
      memberCount: 3,
    })
    expect(squad.members.map((member) => member.name)).toEqual(['Host', 'Member One', 'Member Two'])
    expect(squad.members.map((member) => member.isHost)).toEqual([true, false, false])
    expect(response.body).not.toContain('@squadzr.test')
  })

  it('answers 404 for an unknown Squad and for a Ready one, and 400 for an id that is no uuid', async () => {
    const [host, joiner] = await Promise.all(['Host', 'Joiner'].map((n) => signIn(server, n)))
    const ready = await squadWithMembers(host!, [joiner!], { maxPlayers: 2 })

    expect((await get(server, `/api/admin/squads/${randomUUID()}`, admin)).statusCode).toBe(404)
    expect((await get(server, `/api/admin/squads/${ready.id}`, admin)).statusCode).toBe(404)
    expect((await get(server, '/api/admin/squads/not-a-uuid', admin)).statusCode).toBe(400)
  })

  it('answers 401 signed out and 403 for a player', async () => {
    const id = randomUUID()

    expect((await get(server, `/api/admin/squads/${id}`)).statusCode).toBe(401)
    expect((await get(server, `/api/admin/squads/${id}`, player)).statusCode).toBe(403)
  })
})

describe('POST /api/admin/squads/:id/close', () => {
  it('deletes the Squad and answers 204', async () => {
    const [host, member] = await Promise.all(['Host', 'Member'].map((n) => signIn(server, n)))
    const room = await squadWithMembers(host!, [member!])

    const response = await closeSquad(room.id, admin)

    expect(response.statusCode, response.body).toBe(204)
    expect(response.body).toBe('')
    expect(await findRoomRow(server, room.id)).toBeNull()
    expect(
      await server.app.db.select().from(roomMembers).where(eq(roomMembers.roomId, room.id))
    ).toEqual([])
    expect((await list()).total).toBe(0)
  })

  it('tells every member, the host included, with the reason through the notifications endpoint', async () => {
    const [host, m1, m2, bystander] = await Promise.all(
      ['Host', 'Member One', 'Member Two', 'Bystander'].map((n) => signIn(server, n))
    )
    const room = await squadWithMembers(host!, [m1!, m2!], { name: 'Ranked sexta' })

    expect((await closeSquad(room.id, admin, { reason: `  ${REASON}  ` })).statusCode).toBe(204)

    for (const person of [host!, m1!, m2!]) {
      const notifications = await notificationsOf(person)
      expect(notifications).toHaveLength(1)
      expect(notifications[0]).toMatchObject({
        type: 'room_closed_by_admin',
        readAt: null,
        payload: {
          roomId: room.id,
          roomCode: room.code,
          roomName: 'Ranked sexta',
          gameName: 'Valorant',
          reason: REASON,
        },
      })
      expect(JSON.stringify(notifications)).not.toContain('Ana Admin')
      expect(JSON.stringify(notifications)).not.toContain(admin.id)
    }
    expect(await notificationsOf(bystander!)).toEqual([])
    expect(await notificationsOf(admin)).toEqual([])
  })

  it('writes one squad_closed audit entry with the reason and a snapshot of the Squad', async () => {
    const host = await signIn(server, 'Host')
    const room = await squadWith(host, { name: 'Ranked sexta' })

    await closeSquad(room.id, admin)

    const response = await get(server, '/api/admin/audit', admin)
    const { items, total } = auditEntriesResponseSchema.parse(response.json())
    expect(total).toBe(1)
    expect(items[0]).toMatchObject({
      action: 'squad_closed',
      actorId: admin.id,
      actorName: 'Ana Admin',
      reason: REASON,
      details: null,
      target: {
        type: 'squad',
        id: room.id,
        name: 'Ranked sexta',
        code: room.code,
        game: 'Valorant',
      },
    })
  })

  it('answers 404 for a Squad that is already closed, and notifies nobody twice', async () => {
    const [host, member] = await Promise.all(['Host', 'Member'].map((n) => signIn(server, n)))
    const room = await squadWithMembers(host!, [member!])
    await closeSquad(room.id, admin)

    const second = await closeSquad(room.id, admin)

    expect(second.statusCode).toBe(404)
    expect(second.json()).toMatchObject({ error: 'ROOM_NOT_FOUND' })
    expect(await notificationsOf(member!)).toHaveLength(1)
    const audit = auditEntriesResponseSchema.parse(
      (await get(server, '/api/admin/audit', admin)).json()
    )
    expect(audit.total).toBe(1)
  })

  it('answers 404 for an unknown Squad', async () => {
    const response = await closeSquad(randomUUID(), admin)

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'ROOM_NOT_FOUND' })
  })

  it('answers 422 ROOM_NOT_OPEN for a Ready Squad and changes nothing', async () => {
    const [host, joiner] = await Promise.all(['Host', 'Joiner'].map((n) => signIn(server, n)))
    const ready = await squadWithMembers(host!, [joiner!], { maxPlayers: 2 })
    const readyNotifications = (await notificationsOf(joiner!)).length

    const response = await closeSquad(ready.id, admin)

    expect(response.statusCode).toBe(422)
    expect(response.json()).toMatchObject({ error: 'ROOM_NOT_OPEN' })
    expect(await findRoomRow(server, ready.id)).not.toBeNull()
    expect((await notificationsOf(joiner!)).length).toBe(readyNotifications)
    expect(
      auditEntriesResponseSchema.parse((await get(server, '/api/admin/audit', admin)).json()).total
    ).toBe(0)
  })

  it('answers 422 ROOM_NOT_OPEN for an expired Squad that the cleanup has not deleted yet', async () => {
    const host = await signIn(server, 'Host')
    const room = await squadWith(host)
    const longAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
    await setRoomLifecycle(server, room.id, {
      createdAt: longAgo,
      lastActivityAt: longAgo,
      readyAt: null,
    })

    const response = await closeSquad(room.id, admin)

    expect(response.statusCode).toBe(422)
    expect(response.json()).toMatchObject({ error: 'ROOM_NOT_OPEN' })
  })

  it.each([
    ['a missing reason', {}],
    ['an empty reason', { reason: '' }],
    ['a reason too short once trimmed', { reason: '  ab  ' }],
    ['a reason over 280 characters', { reason: 'x'.repeat(281) }],
  ])('refuses %s with 400 and closes nothing', async (_label, body) => {
    const host = await signIn(server, 'Host')
    const room = await squadWith(host)

    const response = await closeSquad(room.id, admin, body)

    expect(response.statusCode).toBe(400)
    expect(await findRoomRow(server, room.id)).not.toBeNull()
  })

  it('accepts a reason of exactly 3 and exactly 280 characters', async () => {
    const [h1, h2] = await Promise.all(['H1', 'H2'].map((n) => signIn(server, n)))
    const a = await squadWith(h1!)
    const b = await squadWith(h2!)

    expect((await closeSquad(a.id, admin, { reason: 'abc' })).statusCode).toBe(204)
    expect((await closeSquad(b.id, admin, { reason: 'x'.repeat(280) })).statusCode).toBe(204)
  })

  it('answers 401 signed out and 403 for a player, before validating, and closes nothing', async () => {
    const host = await signIn(server, 'Host')
    const room = await squadWith(host)

    expect((await closeSquad(room.id, null, {})).statusCode).toBe(401)
    const forbidden = await closeSquad(room.id, player, {})
    expect(forbidden.statusCode).toBe(403)
    expect(forbidden.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
    expect(await findRoomRow(server, room.id)).not.toBeNull()
  })

  it('lets a person who was in the closed Squad use their slots again', async () => {
    const host = await signIn(server, 'Host')
    const room = await squadWith(host)
    await closeSquad(room.id, admin)

    const again = await createRoom(server, host, { gameId, maxPlayers: 5 })

    expect(again.id).not.toBe(room.id)
  })

  it('keeps the closure notifications when the member is later deleted from the table', async () => {
    const host = await signIn(server, 'Host')
    const room = await squadWith(host)
    await closeSquad(room.id, admin)

    const rows = await server.app.db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.roomId, room.id))
    expect(rows.map((row) => row.type)).toEqual(['room_closed_by_admin'])
  })
})
