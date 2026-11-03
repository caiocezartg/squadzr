import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  MEMBER_PREVIEW_LIMIT,
  myRoomsResponseSchema,
  roomLobbyResponseSchema,
  roomResponseSchema,
  roomsResponseSchema,
  type MemberPreviewDto,
  type RoomDto,
} from '@squadzr/schemas'
import { roomCreatedMessageSchema, roomSnapshotMessageSchema } from '@squadzr/schemas/ws'
import { roomMembers } from '@infrastructure/database/schema'
import { signIn, signInMany, type TestUser } from '@test/harness/auth'
import { DISCORD_INVITE, createRoom, get, insertGame, joinAll } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  type RealtimeSession,
} from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-104: every Squad carries `memberPreview` (up to five members, host first,
// then by join time, then by user id). Public surfaces carry the preview and
// never the full roster or the invite.

const MEMBERS = 6
const BASE_JOIN = Date.parse('2026-02-01T12:00:00.000Z')

let server: TestServer
let host: TestUser
let others: TestUser[]
let gameId: string
const sessions: RealtimeSession[] = []

const preview = (user: TestUser): MemberPreviewDto => ({
  id: user.id,
  name: user.name,
  image: user.image,
})

const firstFive = (users: TestUser[]): MemberPreviewDto[] =>
  users.slice(0, MEMBER_PREVIEW_LIMIT).map(preview)

async function open(...args: Parameters<typeof connect>): Promise<RealtimeSession> {
  const session = await connect(...args)
  sessions.push(session)
  return session
}

/**
 * An Open Squad of the host plus six members, with one seat left. The stored join times are then
 * rewritten so the order is decided by the rules, not by arrival: the host
 * joined last, the first two members tie on the same instant, the rest follow.
 * Returns the users in the expected roster order.
 */
async function seatedSquad(): Promise<{ room: RoomDto; ordered: TestUser[] }> {
  const room = await createRoom(server, host, { gameId, maxPlayers: MEMBERS + 2 })
  await joinAll(server, room.code, others)
  const tied = [others[0]!, others[1]!].sort((a, b) => (a.id < b.id ? -1 : 1))
  const joinTimes = new Map<string, number>([
    [tied[0]!.id, BASE_JOIN],
    [tied[1]!.id, BASE_JOIN],
    ...others.slice(2).map((user, i): [string, number] => [user.id, BASE_JOIN + (i + 1) * 60_000]),
    [host.id, BASE_JOIN + 3_600_000],
  ])
  for (const [userId, at] of joinTimes) {
    await server.app.db
      .update(roomMembers)
      .set({ joinedAt: new Date(at) })
      .where(eq(roomMembers.userId, userId))
  }
  return { room, ordered: [host, ...tied, ...others.slice(2)] }
}

beforeEach(async () => {
  server = await buildTestServer()
  host = await signIn(server, 'Host')
  others = await signInMany(server, MEMBERS)
  gameId = (await insertGame(server, 10)).id
})

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server.close()
})

describe('GET /api/rooms', () => {
  it.each([
    ['an anonymous caller', false],
    ['a signed-in non-member', true],
  ])(
    'lists the first five members, host first, with no roster and no invite, to %s',
    async (_caller, signedIn) => {
      const outsider = (await signInMany(server, 1))[0]!
      const { room, ordered } = await seatedSquad()
      const viewer = signedIn ? outsider : null

      const response = await get(server, '/api/rooms', viewer)

      expect(response.statusCode).toBe(200)
      const { rooms } = roomsResponseSchema.parse(response.json())
      const listed = rooms.find((entry) => entry.id === room.id)
      expect(listed?.memberPreview).toEqual(firstFive(ordered))
      expect(listed?.memberPreview).toHaveLength(MEMBER_PREVIEW_LIMIT)
      expect(listed?.memberCount).toBe(ordered.length)
      expect(listed).not.toHaveProperty('discordLink')
      expect(listed).not.toHaveProperty('players')
      expect(response.body).not.toContain(DISCORD_INVITE)
      expect(response.body).not.toContain(ordered[5]!.id)
    }
  )

  it('carries every member of a Squad with fewer than five', async () => {
    const room = await createRoom(server, host, { gameId })
    await joinAll(server, room.code, [others[0]!])

    const { rooms } = roomsResponseSchema.parse((await get(server, '/api/rooms')).json())

    expect(rooms[0]?.memberPreview.map((entry) => entry.id)).toEqual([host.id, others[0]!.id])
  })

  it('keeps each Squad preview apart in one list', async () => {
    const first = await createRoom(server, host, { gameId })
    const second = await createRoom(server, others[1]!, { gameId })
    await joinAll(server, second.code, [others[0]!])

    const { rooms } = roomsResponseSchema.parse((await get(server, '/api/rooms')).json())

    const previews = Object.fromEntries(
      rooms.map((entry) => [entry.id, entry.memberPreview.map((member) => member.id)])
    )
    expect(previews).toEqual({
      [first.id]: [host.id],
      [second.id]: [others[1]!.id, others[0]!.id],
    })
  })
})

describe('GET /api/rooms/:code', () => {
  it('answers a non-member with the preview, never the roster or the invite', async () => {
    const { room, ordered } = await seatedSquad()
    const outsider = (await signInMany(server, 1))[0]!

    const response = await get(server, `/api/rooms/${room.code}`, outsider)

    expect(response.statusCode).toBe(200)
    const body = roomResponseSchema.parse(response.json())
    expect(body.room.memberPreview).toEqual(firstFive(ordered))
    expect(body).not.toHaveProperty('players')
    expect(body.room).not.toHaveProperty('discordLink')
    expect(response.body).not.toContain(DISCORD_INVITE)
    expect(response.body).not.toContain(ordered[5]!.id)
  })

  it('answers a member with the ordered roster and the first five as the preview', async () => {
    const { room, ordered } = await seatedSquad()

    const response = await get(server, `/api/rooms/${room.code}`, others[3]!)

    const body = roomLobbyResponseSchema.parse(response.json())
    expect(body.players.map((player) => player.id)).toEqual(ordered.map((user) => user.id))
    expect(body.players[0]).toMatchObject({ id: host.id, isHost: true })
    expect(body.room.memberPreview).toEqual(firstFive(ordered))
    expect(body.room.memberPreview).toHaveLength(MEMBER_PREVIEW_LIMIT)
  })
})

describe('GET /api/rooms/my', () => {
  it('carries the preview on hosted and joined Squads', async () => {
    const { room, ordered } = await seatedSquad()
    const hostedByOther = await createRoom(server, others[5]!, { gameId })

    const asHost = myRoomsResponseSchema.parse((await get(server, '/api/rooms/my', host)).json())
    const asMember = myRoomsResponseSchema.parse(
      (await get(server, '/api/rooms/my', others[5]!)).json()
    )

    expect(asHost.hosted.map((entry) => entry.id)).toEqual([room.id])
    expect(asHost.hosted[0]?.memberPreview).toEqual(firstFive(ordered))
    expect(asMember.joined.map((entry) => entry.id)).toEqual([room.id])
    expect(asMember.joined[0]?.memberPreview).toEqual(firstFive(ordered))
    expect(asMember.hosted.map((entry) => entry.id)).toEqual([hostedByOther.id])
    expect(asMember.hosted[0]?.memberPreview).toEqual([preview(others[5]!)])
  })
})

describe('POST /api/rooms and room_created', () => {
  it('returns the host as the whole preview and pushes the same to the catalog', async () => {
    const guest = await open(server)
    await subscribeCatalog(guest)

    const created = await createRoom(server, host, { gameId })

    expect(created.memberPreview).toEqual([preview(host)])
    const [message] = await guest.drain()
    const { payload } = roomCreatedMessageSchema.parse(message)
    expect(payload.room).toMatchObject({ id: created.id, memberPreview: [preview(host)] })
    expect(payload.room).not.toHaveProperty('discordLink')
    expect(payload.room).not.toHaveProperty('players')
  })
})

describe('room_snapshot', () => {
  it('carries the ordered roster and the first five as the room preview', async () => {
    const { room, ordered } = await seatedSquad()
    const socket = await open(server, others[4]!)

    const snapshot = roomSnapshotMessageSchema.parse(await joinRoomChannel(socket, room.code))

    expect(snapshot.payload.players.map((player) => player.id)).toEqual(
      ordered.map((user) => user.id)
    )
    expect(snapshot.payload.room.memberPreview).toEqual(firstFive(ordered))
  })
})
