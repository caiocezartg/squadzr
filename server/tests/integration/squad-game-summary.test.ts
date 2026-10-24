/**
 * CCC-92: every Squad the API sends carries a summary of its Game next to
 * `gameId`, over HTTP and over the realtime channel, including a Squad on a
 * legacy Game. The list, My Squads, the lobby and the realtime snapshot reads
 * join the Game in the same query; the create path reuses the Game it read to
 * validate the input, so a client never needs a second read.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  isRoomLobbyResponse,
  myRoomsResponseSchema,
  roomLobbyResponseSchema,
  roomResponseSchema,
  roomsResponseSchema,
  type GameSummaryDto,
} from '@squadzr/schemas'
import { roomCreatedMessageSchema, roomSnapshotMessageSchema } from '@squadzr/schemas/ws'
import type { Database } from '@infrastructure/database/drizzle'
import { games } from '@infrastructure/database/schema/games'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { signIn, signInMany, type TestUser } from '@test/harness/auth'
import { createRoom, get, insertGameFixture, joinAll } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  type RealtimeSession,
} from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

const GENRES = [
  { slug: 'moba', name: 'MOBA' },
  { slug: 'strategy', name: 'Strategy' },
]

/** The domain shape a read returns: the contract's `coverThumbUrl` is `thumbnailUrl`. */
function domainGame(summary: GameSummaryDto) {
  return {
    id: summary.id,
    name: summary.name,
    slug: summary.slug,
    genres: summary.genres,
    coverUrl: summary.coverUrl,
    thumbnailUrl: summary.coverThumbUrl,
  }
}

let server: TestServer
let host: TestUser
const sessions: RealtimeSession[] = []

async function open(...args: Parameters<typeof connect>): Promise<RealtimeSession> {
  const session = await connect(...args)
  sessions.push(session)
  return session
}

/** Counts `db.select` reads, proving a read needs no per-Squad lookup. */
function countReads(db: Database): { db: Database; reads: () => number; reset: () => void } {
  let reads = 0
  const counted = new Proxy(db, {
    get(target, property, receiver) {
      if (property === 'select') reads += 1
      const value = Reflect.get(target, property, receiver) as unknown
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return {
    db: counted as Database,
    reads: () => reads,
    reset: () => {
      reads = 0
    },
  }
}

beforeEach(async () => {
  server = await buildTestServer()
  host = await signIn(server, 'Host')
})

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server.close()
})

describe('Squad game summary over HTTP', () => {
  it('carries the summary on the create response, the catalog, My Squads and the lobby', async () => {
    const { game, summary } = await insertGameFixture(server, {
      genres: GENRES,
      thumbnailUrl: 'https://cdn.squadzr.test/covers/thumb.webp',
    })
    const [member, outsider] = await signInMany(server, 2)

    const created = await createRoom(server, host, { gameId: game.id })
    expect(created.game).toEqual(summary)

    await joinAll(server, created.code, [member!])

    // A Squad the host belongs to without hosting it, so My Squads answers
    // through its joined query as well.
    const memberRoom = await createRoom(server, member!, { gameId: game.id })
    await joinAll(server, memberRoom.code, [host])

    const listed = roomsResponseSchema.parse((await get(server, '/api/rooms')).json())
    expect(listed.rooms.find((room) => room.id === created.id)?.game).toEqual(summary)

    const mine = myRoomsResponseSchema.parse((await get(server, '/api/rooms/my', host)).json())
    expect(mine.hosted.find((room) => room.id === created.id)?.game).toEqual(summary)
    expect(mine.joined.find((room) => room.id === memberRoom.id)?.game).toEqual(summary)

    const publicRead = roomResponseSchema.parse(
      (await get(server, `/api/rooms/${created.code}`, outsider!)).json()
    )
    expect(isRoomLobbyResponse(publicRead)).toBe(false)
    expect(publicRead.room.game).toEqual(summary)

    const lobby = roomLobbyResponseSchema.parse(
      (await get(server, `/api/rooms/${created.code}`, member!)).json()
    )
    expect(lobby.room.game).toEqual(summary)
  })

  it('summarises a legacy Game like any other', async () => {
    // A legacy row: no IGDB identity, no genres. It starts listed because
    // CCC-93 refuses a new Squad on a delisted Game; the reads below still run
    // after it is delisted.
    const { game, summary } = await insertGameFixture(server, {
      igdbId: null,
      genres: [],
    })
    expect(summary.genres).toEqual([])
    const [member, outsider] = await signInMany(server, 2)
    const guest = await open(server)
    await subscribeCatalog(guest)
    const hostSocket = await open(server, host)

    const created = await createRoom(server, host, { gameId: game.id })
    expect(created.game).toEqual(summary)

    // Delisting keeps the Squad and its summary on every read, even though no
    // new Squad may point at the Game.
    await server.app.db.update(games).set({ listed: false }).where(eq(games.id, game.id))

    const createdMessage = roomCreatedMessageSchema.parse(await guest.next())
    expect(createdMessage.payload.room.game).toEqual(summary)

    const snapshot = roomSnapshotMessageSchema.parse(
      await joinRoomChannel(hostSocket, created.code)
    )
    expect(snapshot.payload.room.game).toEqual(summary)

    await joinAll(server, created.code, [member!])

    const listed = roomsResponseSchema.parse((await get(server, '/api/rooms')).json())
    expect(listed.rooms.find((room) => room.id === created.id)?.game).toEqual(summary)

    const mine = myRoomsResponseSchema.parse((await get(server, '/api/rooms/my', host)).json())
    expect(mine.hosted.find((room) => room.id === created.id)?.game).toEqual(summary)

    const publicRead = roomResponseSchema.parse(
      (await get(server, `/api/rooms/${created.code}`, outsider!)).json()
    )
    expect(isRoomLobbyResponse(publicRead)).toBe(false)
    expect(publicRead.room.game).toEqual(summary)

    const lobby = roomLobbyResponseSchema.parse(
      (await get(server, `/api/rooms/${created.code}`, member!)).json()
    )
    expect(lobby.room.game).toEqual(summary)
  })
})

describe('Squad game summary over realtime', () => {
  it('carries the summary on room_created and room_snapshot', async () => {
    const { game, summary } = await insertGameFixture(server, { genres: GENRES })
    const guest = await open(server)
    await subscribeCatalog(guest)
    const hostSocket = await open(server, host)

    const room = await createRoom(server, host, { gameId: game.id })

    const created = roomCreatedMessageSchema.parse(await guest.next())
    expect(created.payload.room.game).toEqual(summary)

    const snapshot = roomSnapshotMessageSchema.parse(await joinRoomChannel(hostSocket, room.code))
    expect(snapshot.payload.room.game).toEqual(summary)
  })
})

describe('Squad reads join the Game', () => {
  it('reads the summary with the Squad, never with a per-Squad lookup', async () => {
    const { game, summary } = await insertGameFixture(server, { genres: GENRES })
    const room = await createRoom(server, host, { gameId: game.id })
    const now = new Date()

    const counted = countReads(server.app.db)
    const repository = new DrizzleRoomRepository(counted.db, { now: () => now })

    const gameEntity = domainGame(summary)

    counted.reset()
    expect(await repository.findByCode(room.code)).toMatchObject({ game: gameEntity })
    expect(counted.reads()).toBe(1)

    counted.reset()
    expect(await repository.findByIds([room.id])).toMatchObject([{ game: gameEntity }])
    expect(counted.reads()).toBe(1)

    counted.reset()
    expect(await repository.findAvailable(now)).toMatchObject([{ id: room.id, game: gameEntity }])
    expect(counted.reads()).toBe(1)

    counted.reset()
    const mine = await repository.findMyRooms(host.id, now)
    // One query for hosted Squads and one for joined Squads: never one per Squad.
    expect(mine.hosted).toMatchObject([{ id: room.id, game: gameEntity }])
    expect(counted.reads()).toBe(2)
  })
})
