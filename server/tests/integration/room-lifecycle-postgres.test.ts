import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sql, type SQL } from 'drizzle-orm'
import { DeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'
import { buildRoomReadyNotifications } from '@application/use-cases/room/room-ready-notifications'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleRoomMemberRepository } from '@infrastructure/repositories/drizzle-room-member.repository'
import { DrizzleUserNotificationRepository } from '@infrastructure/repositories/drizzle-user-notification.repository'
import { userNotifications } from '@infrastructure/database/schema'
import { ROOM } from '@config/constants'
import { signIn, signInMany, type TestUser } from '@test/harness/auth'
import { FakeClock, TickingClock } from '@test/harness/clock'
import { createRoom, findRoomRow, insertGame, joinAll, setRoomLifecycle } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-36: proves in PostgreSQL that lifecycle writes are transactional and
// clock-driven — Room Activity advances with durable Membership changes,
// readiness and its notifications commit together, and both expiration clocks
// decide reads/deletes at exact instants even before physical deletion.

const FIXED_NOW = new Date('2026-06-01T12:00:00.000Z')
const OPEN_TTL = ROOM.OPEN_ROOM_TTL_MS
const READY_RETENTION = ROOM.READY_ROOM_RETENTION_MS

let server: TestServer
let host: TestUser
let gameId: string
let clock: FakeClock

beforeEach(async () => {
  clock = new FakeClock(FIXED_NOW)
  server = await buildTestServer({}, { clock })
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

describe('lifecycle CHECK constraints', () => {
  it('declares the three invariants on rooms', async () => {
    const constraints = await server.app.db.execute<{ conname: string }>(sql`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.rooms'::regclass AND contype = 'c'
      ORDER BY conname
    `)

    expect(constraints.rows.map((row) => row.conname)).toEqual([
      'rooms_last_activity_after_created',
      'rooms_ready_after_created',
      'rooms_ready_after_last_activity',
    ])
  })

  it('rejects last_activity_at before created_at with 23514', async () => {
    await expect(
      server.app.db.execute(sql`
        INSERT INTO "rooms" (code, name, host_id, game_id, last_activity_at, created_at)
        VALUES ('CHK001', 'Constraint room', ${host.id}, ${gameId}, now() - interval '1 second', now())
      `)
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('rejects ready_at before created_at with 23514', async () => {
    await expect(
      server.app.db.execute(sql`
        INSERT INTO "rooms" (code, name, host_id, game_id, ready_at, last_activity_at, created_at)
        VALUES (
          'CHK002', 'Constraint room', ${host.id}, ${gameId},
          now() - interval '1 second', now() - interval '1 second', now()
        )
      `)
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('rejects ready_at before last_activity_at with 23514', async () => {
    await expect(
      server.app.db.execute(sql`
        INSERT INTO "rooms" (code, name, host_id, game_id, ready_at, last_activity_at, created_at)
        VALUES (
          'CHK003', 'Constraint room', ${host.id}, ${gameId},
          now() - interval '90 seconds', now() - interval '1 minute', now() - interval '2 minutes'
        )
      `)
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('accepts the exact boundary ready_at = last_activity_at = created_at', async () => {
    await server.app.db.execute(sql`
      INSERT INTO "rooms" (code, name, host_id, game_id, ready_at, last_activity_at, created_at)
      VALUES ('CHK004', 'Constraint room', ${host.id}, ${gameId}, now(), now(), now())
    `)

    const { rows } = await server.app.db.execute<{ ready_at: Date; created_at: Date }>(sql`
      SELECT ready_at, created_at FROM "rooms" WHERE code = 'CHK004'
    `)
    expect(rows[0]?.ready_at).toEqual(rows[0]?.created_at)
  })

  it('rejects an update that moves last_activity_at before created_at with 23514', async () => {
    const room = await createRoom(server, host, { gameId })

    await expect(
      server.app.db.execute(sql`
        UPDATE "rooms" SET last_activity_at = created_at - interval '1 second' WHERE id = ${room.id}
      `)
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('rejects an update that moves ready_at before last_activity_at with 23514', async () => {
    const room = await createRoom(server, host, { gameId })

    await expect(
      server.app.db.execute(sql`
        UPDATE "rooms" SET ready_at = last_activity_at - interval '1 second' WHERE id = ${room.id}
      `)
    ).rejects.toMatchObject({ code: '23514' })
  })
})

describe('lifecycle columns', () => {
  it('stamps creation with the injected clock and leaves ready_at null', async () => {
    const room = await createRoom(server, host, { gameId })

    const row = await findRoomRow(server, room.id)

    expect(row?.createdAt).toEqual(FIXED_NOW)
    expect(row?.lastActivityAt).toEqual(FIXED_NOW)
    expect(row?.readyAt).toBeNull()
  })

  it('sets ready_at and last_activity_at to the same injected instant on the last join', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })

    await joinAll(server, room.code, [member!])

    const row = await findRoomRow(server, room.id)
    expect(row?.readyAt).toEqual(FIXED_NOW)
    expect(row?.lastActivityAt).toEqual(FIXED_NOW)
  })
})

describe('ready_at filters', () => {
  it('lists only Open Rooms inside the activity window from findAvailable', async () => {
    const repository = new DrizzleRoomRepository(server.app.db)
    const open = await createRoom(server, host, { gameId })
    const stale = await createRoom(server, host, { gameId })
    await setRoomLifecycle(server, stale.id, {
      createdAt: FIXED_NOW,
      lastActivityAt: new Date(FIXED_NOW.getTime() - OPEN_TTL),
      readyAt: null,
    })

    const available = await repository.findAvailable(FIXED_NOW)

    expect(available.map((room) => room.id)).toEqual([open.id])
  })

  it('expires an Open Room at exactly lastActivityAt + 24h', async () => {
    const repository = new DrizzleRoomRepository(server.app.db)
    const room = await createRoom(server, host, { gameId })
    await setRoomLifecycle(server, room.id, {
      createdAt: FIXED_NOW,
      lastActivityAt: new Date(FIXED_NOW.getTime() - OPEN_TTL),
      readyAt: null,
    })

    const expired = await repository.findExpiredRooms(FIXED_NOW)

    expect(expired.map((r) => r.id)).toEqual([room.id])
    expect(await repository.deleteExpired(room.id, FIXED_NOW)).toBe(true)
    expect(await findRoomRow(server, room.id)).toBeNull()
  })

  it('expires a Ready Room at exactly readyAt + 60min', async () => {
    const repository = new DrizzleRoomRepository(server.app.db)
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])
    const expiredAt = new Date(FIXED_NOW.getTime() - READY_RETENTION)
    await setRoomLifecycle(server, room.id, {
      createdAt: expiredAt,
      lastActivityAt: expiredAt,
      readyAt: expiredAt,
    })

    const expired = await repository.findExpiredRooms(FIXED_NOW)

    expect(expired.map((r) => r.id)).toEqual([room.id])
  })

  it('keeps a Ready Room one millisecond before readyAt + 60min', async () => {
    const repository = new DrizzleRoomRepository(server.app.db)
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])
    const insideAt = new Date(FIXED_NOW.getTime() - READY_RETENTION + 1)
    await setRoomLifecycle(server, room.id, {
      createdAt: insideAt,
      lastActivityAt: insideAt,
      readyAt: insideAt,
    })

    expect(await repository.findExpiredRooms(FIXED_NOW)).toEqual([])
    expect(await repository.deleteExpired(room.id, FIXED_NOW)).toBe(false)
  })

  it('does not delete a room whose activity advanced after the scheduler listed it', async () => {
    const repository = new DrizzleRoomRepository(server.app.db)
    const room = await createRoom(server, host, { gameId })
    await setRoomLifecycle(server, room.id, {
      createdAt: FIXED_NOW,
      lastActivityAt: new Date(FIXED_NOW.getTime() - OPEN_TTL),
      readyAt: null,
    })
    // A concurrent join commits after the expired list was read.
    await setRoomLifecycle(server, room.id, {
      createdAt: FIXED_NOW,
      lastActivityAt: FIXED_NOW,
      readyAt: null,
    })

    expect(await repository.deleteExpired(room.id, FIXED_NOW)).toBe(false)
    expect(await findRoomRow(server, room.id)).not.toBeNull()
  })
})

describe('join and leave transactions', () => {
  it('advances Room Activity on a non-final join and leaves ready_at null', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 3 })
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)
    const joinedAt = new Date(FIXED_NOW.getTime() + 5 * 60_000)
    clock.set(joinedAt)

    const outcome = await repository.joinOpenRoom({
      roomId: room.id,
      userId: member!.id,
    })

    expect(outcome.status).toBe('joined')
    const row = await findRoomRow(server, room.id)
    expect(row?.lastActivityAt).toEqual(joinedAt)
    expect(row?.readyAt).toBeNull()
  })

  it('stamps each concurrent join from the clock read after the room lock', async () => {
    const [first, second] = await signInMany(server, 2)
    const room = await createRoom(server, host, { gameId, maxPlayers: 3 })
    // Ticks on every read: if the instant were captured before the lock, both
    // transactions would share one value and the later write could regress.
    const ticking = new TickingClock(FIXED_NOW)
    const repository = new DrizzleRoomMemberRepository(server.app.db, ticking)

    const [firstOutcome, secondOutcome] = await Promise.all([
      repository.joinOpenRoom({ roomId: room.id, userId: first!.id }),
      repository.joinOpenRoom({ roomId: room.id, userId: second!.id }),
    ])

    expect(firstOutcome.status).toBe('joined')
    expect(secondOutcome.status).toBe('joined')
    if (firstOutcome.status !== 'joined' || secondOutcome.status !== 'joined') {
      throw new Error('unreachable')
    }

    const joinedAt = [
      firstOutcome.member.joinedAt.getTime(),
      secondOutcome.member.joinedAt.getTime(),
    ]
    expect(new Set(joinedAt).size).toBe(2)

    const row = await findRoomRow(server, room.id)
    expect(row?.lastActivityAt.getTime()).toBe(Math.max(...joinedAt))
    expect(row?.lastActivityAt.getTime()).toBeGreaterThan(Math.min(...joinedAt))
  })

  it('persists readiness and every member notification in one transaction', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)
    const users = await server.app.db.execute<{ id: string; name: string }>(
      sql`SELECT id, name FROM "user" WHERE id IN (${host.id}, ${member!.id})`
    )
    const memberRepository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)

    const outcome = await repository.joinOpenRoom({
      roomId: room.id,
      userId: member!.id,
      buildReadyNotifications: (members) =>
        buildRoomReadyNotifications({
          room: {
            id: room.id,
            code: room.code,
            name: room.name,
          },
          members,
          users: users.rows.map((row) => ({
            id: row.id,
            email: '',
            name: row.name,
            avatarUrl: null,
            createdAt: FIXED_NOW,
            updatedAt: FIXED_NOW,
          })),
          gameName: 'League of Legends',
        }),
    })

    expect(outcome.status).toBe('joined')
    if (outcome.status !== 'joined') throw new Error('unreachable')
    expect(outcome.becameReady).toBe(true)
    expect(outcome.notifications).toHaveLength(2)
    expect(await memberRepository.countByRoomId(room.id)).toBe(2)

    const row = await findRoomRow(server, room.id)
    expect(row?.readyAt).toEqual(FIXED_NOW)
    expect(row?.lastActivityAt).toEqual(FIXED_NOW)

    const persisted = await countRows(
      sql`SELECT count(*)::int AS total FROM user_notifications WHERE room_id = ${room.id}`
    )
    expect(persisted).toBe(2)

    const payload = await server.app.db.execute<{ payload: Record<string, unknown> }>(
      sql`SELECT payload FROM user_notifications WHERE room_id = ${room.id} LIMIT 1`
    )
    expect(payload.rows[0]?.payload).not.toHaveProperty('discordLink')
  })

  it('returns ready without inserting when the room is ready with a free seat', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 3 })
    await server.app.db.execute(sql`
      UPDATE "rooms" SET ready_at = ${FIXED_NOW} WHERE id = ${room.id}
    `)
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)

    const outcome = await repository.joinOpenRoom({
      roomId: room.id,
      userId: member!.id,
    })

    expect(outcome).toEqual({ status: 'ready' })
    expect(await repository.countByRoomId(room.id)).toBe(1)
  })

  it('returns full at capacity, before readiness', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])
    const [late] = await signInMany(server, 1)
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)

    const outcome = await repository.joinOpenRoom({
      roomId: room.id,
      userId: late!.id,
    })

    expect(outcome).toEqual({ status: 'full', memberCount: 2 })
  })

  it('returns expired at exactly lastActivityAt + 24h', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    await setRoomLifecycle(server, room.id, {
      createdAt: FIXED_NOW,
      lastActivityAt: new Date(FIXED_NOW.getTime() - OPEN_TTL),
      readyAt: null,
    })
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)

    const outcome = await repository.joinOpenRoom({
      roomId: room.id,
      userId: member!.id,
    })

    expect(outcome).toEqual({ status: 'expired' })
  })

  it('retries keep one logical notification per member', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    const notificationRepository = new DrizzleUserNotificationRepository(server.app.db)
    await notificationRepository.create({
      userId: host.id,
      roomId: room.id,
      type: 'room_ready',
      title: 'Room ready',
      message: 'Already persisted before the retry.',
      payload: {
        roomId: room.id,
        roomCode: room.code,
        roomName: room.name,
        gameName: 'League of Legends',
        players: [],
      },
    })
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)

    const outcome = await repository.joinOpenRoom({
      roomId: room.id,
      userId: member!.id,
      buildReadyNotifications: (members) =>
        members.map((roomMember) => ({
          userId: roomMember.userId,
          roomId: room.id,
          type: 'room_ready' as const,
          title: 'Room ready',
          message: 'Retry.',
          payload: {
            roomId: room.id,
            roomCode: room.code,
            roomName: room.name,
            gameName: 'League of Legends',
            players: [],
          },
        })),
    })

    expect(outcome.status).toBe('joined')
    if (outcome.status !== 'joined') throw new Error('unreachable')
    // Only the member missing a notification is inserted; the existing one is kept.
    expect(outcome.notifications.map((notification) => notification.userId)).toEqual([member!.id])
    expect(
      await countRows(
        sql`SELECT count(*)::int AS total FROM user_notifications WHERE room_id = ${room.id} AND user_id = ${host.id}`
      )
    ).toBe(1)
    expect(
      await countRows(
        sql`SELECT count(*)::int AS total FROM user_notifications WHERE room_id = ${room.id}`
      )
    ).toBe(2)
  })

  it('advances Room Activity when a regular member leaves', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 3 })
    await joinAll(server, room.code, [member!])
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)
    const leftAt = new Date(FIXED_NOW.getTime() + 5 * 60_000)

    const outcome = await repository.leaveOpenRoom({
      roomId: room.id,
      userId: member!.id,
      now: leftAt,
    })

    expect(outcome).toEqual({ status: 'left', wasHost: false, memberCount: 1 })
    const row = await findRoomRow(server, room.id)
    expect(row?.lastActivityAt).toEqual(leftAt)
    expect(row?.readyAt).toBeNull()
  })

  it('rejects leaving once the room is ready', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)

    const outcome = await repository.leaveOpenRoom({
      roomId: room.id,
      userId: member!.id,
      now: FIXED_NOW,
    })

    expect(outcome).toEqual({ status: 'ready' })
    expect(await repository.countByRoomId(room.id)).toBe(2)
  })

  it('deletes the room and every membership when the host leaves', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 3 })
    await joinAll(server, room.code, [member!])
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)

    const outcome = await repository.leaveOpenRoom({
      roomId: room.id,
      userId: host.id,
      now: FIXED_NOW,
    })

    expect(outcome).toEqual({ status: 'left', wasHost: true, memberCount: 0 })
    expect(await findRoomRow(server, room.id)).toBeNull()
    expect(
      await countRows(
        sql`SELECT count(*)::int AS total FROM room_members WHERE room_id = ${room.id}`
      )
    ).toBe(0)
  })

  it('returns not_member for a caller without Membership', async () => {
    const [outsider] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })
    const repository = new DrizzleRoomMemberRepository(server.app.db, server.app.clock)

    const outcome = await repository.leaveOpenRoom({
      roomId: room.id,
      userId: outsider!.id,
      now: FIXED_NOW,
    })

    expect(outcome).toEqual({ status: 'not_member' })
  })
})

describe('expiration cleanup use case', () => {
  it('deletes both expired Open Rooms and expired Ready Rooms, reporting the reason', async () => {
    const [member] = await signInMany(server, 1)
    const repository = new DrizzleRoomRepository(server.app.db)
    const useCase = new DeleteExpiredRoomsUseCase(repository, clock)
    const openExpired = await createRoom(server, host, { gameId })
    await setRoomLifecycle(server, openExpired.id, {
      createdAt: FIXED_NOW,
      lastActivityAt: new Date(FIXED_NOW.getTime() - OPEN_TTL),
      readyAt: null,
    })
    const readyExpired = await createRoom(server, host, { gameId, maxPlayers: 2 })
    await joinAll(server, readyExpired.code, [member!])
    const expiredAt = new Date(FIXED_NOW.getTime() - READY_RETENTION)
    await setRoomLifecycle(server, readyExpired.id, {
      createdAt: expiredAt,
      lastActivityAt: expiredAt,
      readyAt: expiredAt,
    })
    const fresh = await createRoom(server, host, { gameId })

    const result = await useCase.execute()

    expect(result.deletedRooms.map((room) => room.reason).sort()).toEqual([
      'open_expired',
      'ready_expired',
    ])
    expect(await findRoomRow(server, openExpired.id)).toBeNull()
    expect(await findRoomRow(server, readyExpired.id)).toBeNull()
    expect(await findRoomRow(server, fresh.id)).not.toBeNull()
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
