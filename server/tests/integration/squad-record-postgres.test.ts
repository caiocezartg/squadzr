import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asc, eq, sql } from 'drizzle-orm'
import { ROOM } from '@config/constants'
import { DeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'
import { squadRecordMembers, squadRecords } from '@infrastructure/database/schema'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { recordCompletedSquad } from '@infrastructure/repositories/room-join-steps'
import { signIn, signInMany } from '@test/harness/auth'
import { FakeClock } from '@test/harness/clock'
import { createRoom, findRoomRow, insertGame, joinAll, roomAction } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #114: the join that fills a Squad writes its Squad Record in the same transaction, and the
// record outlives the cleanup that deletes the Squad.

const NOW = new Date('2026-10-01T12:00:00.000Z')

let server: TestServer
let clock: FakeClock

beforeEach(async () => {
  clock = new FakeClock(NOW)
  server = await buildTestServer({}, { clock })
})

afterEach(async () => {
  await server.close()
})

async function recordsOf(roomId: string) {
  return server.app.db.select().from(squadRecords).where(eq(squadRecords.roomId, roomId))
}

async function recordMembers(recordId: string) {
  return server.app.db
    .select()
    .from(squadRecordMembers)
    .where(eq(squadRecordMembers.recordId, recordId))
    .orderBy(asc(squadRecordMembers.joinedAt))
}

describe('recordCompletedSquad inside the final join', () => {
  it('records the Game, name, platform, host, size, Ready instant and every member', async () => {
    const game = await insertGame(server, { platforms: ['pc'], maxPlayers: 3 })
    const [host, second, third] = await signInMany(server, 3)
    const room = await createRoom(server, host!, {
      gameId: game.id,
      maxPlayers: 3,
      name: 'Night squad',
      platform: 'pc',
    })
    clock.advance(1_000)
    await joinAll(server, room.code, [second!])
    clock.advance(1_000)
    const readyAt = clock.now()
    await joinAll(server, room.code, [third!])

    const [record] = await recordsOf(room.id)
    expect(record).toMatchObject({
      roomId: room.id,
      gameId: game.id,
      name: 'Night squad',
      platform: 'pc',
      hostId: host!.id,
      maxPlayers: 3,
      readyAt,
    })
    const members = await recordMembers(record!.id)
    expect(members.map((member) => member.userId)).toEqual([host!.id, second!.id, third!.id])
    expect(members[2]!.joinedAt).toEqual(readyAt)
  })

  it('writes nothing while the Squad is still open', async () => {
    const game = await insertGame(server)
    const [host, member] = await signInMany(server, 2)
    const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: 3 })
    await joinAll(server, room.code, [member!])

    expect(await recordsOf(room.id)).toEqual([])
  })

  it('keeps one record when the Squad is recorded again, without touching its members', async () => {
    const game = await insertGame(server)
    const [host, member] = await signInMany(server, 2)
    const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])
    const [record] = await recordsOf(room.id)
    const before = await recordMembers(record!.id)

    await server.app.db.transaction(async (tx) => {
      await recordCompletedSquad(tx, {
        room: {
          id: room.id,
          gameId: game.id,
          name: 'Other name',
          platform: null,
          hostId: host!.id,
          maxPlayers: 2,
        },
        roster: {
          members: [{ id: 'x', roomId: room.id, userId: host!.id, joinedAt: clock.now() }],
          users: [],
        },
        readyAt: clock.now(),
      })
    })

    expect(await recordsOf(room.id)).toEqual([record])
    expect(await recordMembers(record!.id)).toEqual(before)
  })

  it('rolls the whole join back when the record cannot be written', async () => {
    const game = await insertGame(server)
    const [host, member] = await signInMany(server, 2)
    const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: 2 })
    await server.app.db.execute(sql`
      CREATE FUNCTION squad_record_members_fail() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'squad record members are down'; END;
      $$ LANGUAGE plpgsql`)
    await server.app.db.execute(sql`
      CREATE TRIGGER squad_record_members_fail BEFORE INSERT ON squad_record_members
      FOR EACH ROW EXECUTE FUNCTION squad_record_members_fail()`)

    const response = await roomAction(server, member!, room.code, 'join')

    expect(response.statusCode).toBe(500)
    expect((await findRoomRow(server, room.id))?.readyAt).toBeNull()
    expect(await recordsOf(room.id)).toEqual([])
    const members = await server.app.db.execute(
      sql`SELECT 1 FROM room_members WHERE room_id = ${room.id} AND user_id = ${member!.id}`
    )
    expect(members.rows).toHaveLength(0)
  })
})

describe('Squad Records and the cleanup', () => {
  it('keeps the record and its members after the cleanup deletes the Ready Squad', async () => {
    const game = await insertGame(server)
    const [host, member] = await signInMany(server, 2)
    const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])
    clock.advance(ROOM.READY_ROOM_RETENTION_MS)
    const useCase = new DeleteExpiredRoomsUseCase(
      new DrizzleRoomRepository(server.app.db, clock),
      clock
    )

    const { deletedRooms } = await useCase.execute()

    expect(deletedRooms).toEqual([{ id: room.id, code: room.code, reason: 'ready_expired' }])
    expect(await findRoomRow(server, room.id)).toBeNull()
    const [record] = await recordsOf(room.id)
    expect(record).toMatchObject({ roomId: room.id, name: room.name, hostId: host!.id })
    expect((await recordMembers(record!.id)).map((m) => m.userId).sort()).toEqual(
      [host!.id, member!.id].sort()
    )
  })

  it('writes no record for a Squad that only stayed open and expired', async () => {
    const game = await insertGame(server)
    const [host, member] = await signInMany(server, 2)
    const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: 3 })
    await joinAll(server, room.code, [member!])
    clock.advance(ROOM.OPEN_ROOM_TTL_MS)
    const useCase = new DeleteExpiredRoomsUseCase(
      new DrizzleRoomRepository(server.app.db, clock),
      clock
    )

    const { deletedRooms } = await useCase.execute()

    expect(deletedRooms.map((deleted) => deleted.reason)).toEqual(['open_expired'])
    expect(await server.app.db.select().from(squadRecords)).toEqual([])
  })

  it('keeps the record when a member account is deleted, dropping only that membership', async () => {
    const game = await insertGame(server)
    const host = await signIn(server, 'Host')
    const member = await signIn(server, 'Member')
    const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 2 })
    await joinAll(server, room.code, [member])
    const [record] = await recordsOf(room.id)

    await server.app.db.execute(sql`DELETE FROM "user" WHERE id = ${host.id}`)

    expect((await recordsOf(room.id))[0]).toMatchObject({ id: record!.id, hostId: null })
    expect((await recordMembers(record!.id)).map((m) => m.userId)).toEqual([member.id])
  })
})
