import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sql, type SQL } from 'drizzle-orm'
import { DeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleUserNotificationRepository } from '@infrastructure/repositories/drizzle-user-notification.repository'
import { userNotifications } from '@infrastructure/database/schema'
import { signIn, signInMany, type TestUser } from '@test/harness/auth'
import {
  createRoom,
  findRoomRow,
  get,
  insertGame,
  joinAll,
  markRoomReady,
} from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-35: proves in PostgreSQL that the persisted room lifecycle is
// timestamp-driven — ready_at/last_activity_at exist, completed_at,
// ready_notified_at and room_status are gone, the filters read ready_at, and
// the user_notifications idempotency key rejects a second insert.

let server: TestServer
let host: TestUser
let gameId: string

beforeEach(async () => {
  server = await buildTestServer()
  host = await signIn(server, 'Host')
  gameId = (await insertGame(server)).id
})

afterEach(async () => {
  await server.close()
})

async function roomColumns(): Promise<Record<string, { isNullable: string }>> {
  const result = await server.app.db.execute<{ column_name: string; is_nullable: string }>(sql`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rooms'
  `)

  return Object.fromEntries(
    result.rows.map((row) => [row.column_name, { isNullable: row.is_nullable }])
  )
}

async function countRows(query: SQL): Promise<number> {
  const result = await server.app.db.execute<{ total: number }>(query)
  return Number(result.rows[0]?.total ?? 0)
}

describe('rooms schema after the lifecycle migration', () => {
  it('keeps the timestamp columns and removes the speculative ones', async () => {
    const columns = await roomColumns()

    expect(Object.keys(columns).sort()).toEqual(
      [
        'code',
        'created_at',
        'discord_link',
        'game_id',
        'host_id',
        'id',
        'language',
        'last_activity_at',
        'max_players',
        'name',
        'ready_at',
        'tags',
        'updated_at',
      ].sort()
    )
    expect(columns['ready_at']?.isNullable).toBe('YES')
    expect(columns['last_activity_at']?.isNullable).toBe('NO')
  })

  it('drops the room_status enum and every reference to it', async () => {
    const enums = await countRows(
      sql`SELECT count(*)::int AS total FROM pg_type WHERE typname = 'room_status'`
    )

    expect(enums).toBe(0)
  })

  it('adds a nullable room_id to user_notifications without a foreign key to rooms', async () => {
    const columns = await server.app.db.execute<{ column_name: string; is_nullable: string }>(sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_notifications'
        AND column_name = 'room_id'
    `)
    expect(columns.rows).toEqual([{ column_name: 'room_id', is_nullable: 'YES' }])

    const foreignKeys = await countRows(sql`
      SELECT count(*)::int AS total
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid = 'public.user_notifications'::regclass
        AND confrelid = 'public.rooms'::regclass
    `)
    expect(foreignKeys).toBe(0)
  })

  it('creates the (room_id, user_id, type) unique index', async () => {
    const indexes = await server.app.db.execute<{ indexname: string }>(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'user_notifications'
        AND indexname = 'user_notifications_room_user_type_unique'
    `)

    expect(indexes.rows).toEqual([{ indexname: 'user_notifications_room_user_type_unique' }])
  })
})

describe('lifecycle columns', () => {
  it('stamps last_activity_at on creation and leaves ready_at null', async () => {
    const room = await createRoom(server, host, { gameId })

    const row = await findRoomRow(server, room.id)

    expect(row?.lastActivityAt).toBeInstanceOf(Date)
    expect(row?.readyAt).toBeNull()
  })

  it('sets ready_at when the last membership fills the room', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })

    await joinAll(server, room.code, [member!])

    const row = await findRoomRow(server, room.id)
    expect(row?.readyAt).toBeInstanceOf(Date)
    expect(row?.lastActivityAt).toBeInstanceOf(Date)
  })
})

describe('ready_at filters', () => {
  it('lists open rooms and drops ready rooms past the grace window from findAvailable', async () => {
    const repository = new DrizzleRoomRepository(server.app.db)
    const open = await createRoom(server, host, { gameId })
    const stale = await createRoom(server, host, { gameId })
    await markRoomReady(server, stale.id, 6)

    const available = await repository.findAvailable()

    expect(available.map((room) => room.id)).toEqual([open.id])
  })

  it('expires only ready rooms through findExpiredRooms', async () => {
    const repository = new DrizzleRoomRepository(server.app.db)
    const useCase = new DeleteExpiredRoomsUseCase(repository)
    const stale = await createRoom(server, host, { gameId })
    const open = await createRoom(server, host, { gameId })
    await markRoomReady(server, stale.id, 61)

    const result = await useCase.execute({ expirationMinutes: 60 })

    expect(result.deletedRooms).toEqual([{ id: stale.id, code: stale.code }])
    expect(await findRoomRow(server, stale.id)).toBeNull()
    expect(await findRoomRow(server, open.id)).not.toBeNull()
  })

  it('keeps ready rooms in the caller catalog inside the grace window', async () => {
    const room = await createRoom(server, host, { gameId })
    await markRoomReady(server, room.id, 4)

    const response = await get(server, '/api/rooms')

    expect(response.json()).toMatchObject({ rooms: [{ id: room.id }] })
  })
})

describe('user_notifications idempotency key', () => {
  const notificationInput = (roomId: string, userId: string) => ({
    userId,
    roomId,
    type: 'room_ready' as const,
    title: 'Room ready',
    message: 'Your squad is full.',
    payload: {
      roomId,
      roomCode: 'ABC123',
      roomName: 'Ranked squad',
      gameName: 'League of Legends',
      players: [{ name: 'Host', image: null }],
      discordLink: 'https://discord.gg/squadzr',
    },
  })

  it('rejects a second insert with the same (room_id, user_id, type)', async () => {
    const repository = new DrizzleUserNotificationRepository(server.app.db)
    const room = await createRoom(server, host, { gameId })
    const input = notificationInput(room.id, host.id)

    const created = await repository.create(input)

    expect(created).toMatchObject({ roomId: room.id, type: 'room_ready' })
    await expect(repository.create(input)).rejects.toMatchObject({ code: '23505' })
    expect(
      await countRows(
        sql`SELECT count(*)::int AS total FROM user_notifications WHERE room_id = ${room.id}`
      )
    ).toBe(1)
  })

  it('ignores a conflicting insert when the caller opts into ON CONFLICT DO NOTHING', async () => {
    const room = await createRoom(server, host, { gameId })
    const input = notificationInput(room.id, host.id)

    await server.app.db.insert(userNotifications).values(input)
    await server.app.db.insert(userNotifications).values(input).onConflictDoNothing()

    expect(
      await countRows(
        sql`SELECT count(*)::int AS total FROM user_notifications WHERE room_id = ${room.id}`
      )
    ).toBe(1)
  })

  it('preserves the notification history after the room is deleted', async () => {
    const repository = new DrizzleUserNotificationRepository(server.app.db)
    const roomRepository = new DrizzleRoomRepository(server.app.db)
    const room = await createRoom(server, host, { gameId })
    await repository.create(notificationInput(room.id, host.id))

    await roomRepository.delete(room.id)

    const remaining = await server.app.db.execute<{ room_id: string }>(
      sql`SELECT room_id FROM user_notifications WHERE room_id = ${room.id}`
    )
    expect(remaining.rows).toEqual([{ room_id: room.id }])
  })
})
