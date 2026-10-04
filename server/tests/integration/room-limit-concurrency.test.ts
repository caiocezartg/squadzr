import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import pg from 'pg'
import { and, count, eq } from 'drizzle-orm'
import { ROOM } from '@config/constants'
import { roomMembers, rooms, userNotifications } from '@infrastructure/database/schema'
import { validOpenRoomCondition } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleRoomMemberRepository } from '@infrastructure/repositories/drizzle-room-member.repository'
import { signIn, signInMany } from '@test/harness/auth'
import { FakeClock } from '@test/harness/clock'
import {
  createRoom,
  findRoomRow,
  insertGame,
  joinAll,
  postRoom,
  roomAction,
  setRoomLifecycle,
} from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-53: the per-user Membership limit and the per-host room limit are decided
// inside the transaction that writes the row, under a lock on the user row.
// Lock barriers force writes to overlap after any old pre-transaction counts.
// Crossed final joins also pause before notification FK checks, with each user
// lock already held, to expose an incompatible lock mode deterministically.
// Every concurrent operation must complete within the explicit 5s deadline.

const COMPLETION_LIMIT_MS = 5_000

let server: TestServer
let control: pg.Client

beforeEach(async () => {
  server = await buildTestServer()
  control = new pg.Client({ connectionString: server.databaseUrl })
  await control.connect()
})

afterEach(async () => {
  await control.end()
  await server.close()
})

async function withinDeadline<T>(work: Promise<T>, description: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${description} did not finish within ${COMPLETION_LIMIT_MS}ms`)),
          COMPLETION_LIMIT_MS
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Waits until `expected` sessions of this test database are parked on a
 * lock. PostgreSQL caches activity snapshots until the control transaction ends.
 */
async function waitForLockedSessions(
  expected: number,
  queryPatterns = ['%for update', '%for no key update']
): Promise<void> {
  const deadline = performance.now() + COMPLETION_LIMIT_MS
  while (performance.now() < deadline) {
    await control.query('SELECT pg_stat_clear_snapshot()')
    const { rows } = await control.query<{ waiting: number }>(
      `
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE ANY($1::text[])
    `,
      [queryPatterns]
    )
    if ((rows[0]?.waiting ?? 0) >= expected) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Not all ${expected} sessions reached the lock barrier`)
}

/** Memberships counted by the join limit: valid Open Rooms only. */
async function activeMemberships(userId: string): Promise<number> {
  const [row] = await server.app.db
    .select({ total: count() })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(and(eq(roomMembers.userId, userId), validOpenRoomCondition(new Date())))
  return row?.total ?? 0
}

/** Rooms counted by the host limit: valid Open Rooms only. */
async function hostedRooms(hostId: string): Promise<number> {
  const [row] = await server.app.db
    .select({ total: count() })
    .from(rooms)
    .where(and(eq(rooms.hostId, hostId), validOpenRoomCondition(new Date())))
  return row?.total ?? 0
}

describe('active room limits under a concurrent race', () => {
  it(`rejects every concurrent join when the user already holds ${ROOM.JOIN_LIMIT} memberships`, async () => {
    const [player] = await signInMany(server, 1)
    const game = await insertGame(server)
    const hosts = await signInMany(server, ROOM.JOIN_LIMIT * 2)
    const rooms = []
    for (const host of hosts) rooms.push(await createRoom(server, host, { gameId: game.id }))

    const seeded = rooms.slice(0, ROOM.JOIN_LIMIT)
    const targets = rooms.slice(ROOM.JOIN_LIMIT)
    for (const room of seeded) await joinAll(server, room.code, [player!])
    expect(await activeMemberships(player!.id)).toBe(ROOM.JOIN_LIMIT)

    // This is the saturated boundary case, not a regression of the old count:
    // at five memberships its pre-transaction guard already rejects every
    // request. A room-lock barrier would time out on that correct early exit.
    // The one-free-slot test below proves the actual oversubscription race.
    const responses = await withinDeadline(
      Promise.all(targets.map((room) => roomAction(server, player!, room.code, 'join'))),
      'Concurrent joins'
    )

    for (const response of responses) {
      expect(response.statusCode, response.body).toBe(422)
      expect(response.json()).toEqual({
        error: 'ROOM_JOIN_LIMIT_REACHED',
        message: `You can only be in ${ROOM.JOIN_LIMIT} active rooms at a time`,
      })
    }
    expect(await activeMemberships(player!.id)).toBe(ROOM.JOIN_LIMIT)
  })

  it('finishes crossed final joins with notifications without a user FK deadlock', async () => {
    const [first, second] = await signInMany(server, 2)
    const game = await insertGame(server)
    const firstRoom = await createRoom(server, first!, { gameId: game.id, maxPlayers: 2 })
    const secondRoom = await createRoom(server, second!, { gameId: game.id, maxPlayers: 2 })

    // Pause BEFORE the FK checks, with both transactions already holding their
    // room and joining-user locks. Shared advisory locks let both proceed when
    // the control lock is released, exposing the crossed notification FKs.
    await control.query(`
      CREATE FUNCTION pause_ready_notifications() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock_shared(53);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER pause_ready_notifications BEFORE INSERT ON user_notifications
      FOR EACH ROW EXECUTE FUNCTION pause_ready_notifications();
    `)
    await control.query('BEGIN')
    await control.query('SELECT pg_advisory_xact_lock(53)')
    const pending = Promise.all([
      roomAction(server, second!, firstRoom.code, 'join'),
      roomAction(server, first!, secondRoom.code, 'join'),
    ])
    try {
      await waitForLockedSessions(2, ['insert into "user_notifications"%'])
      await control.query('COMMIT')
      const responses = await withinDeadline(pending, 'Crossed final joins')

      for (const response of responses) expect(response.statusCode, response.body).toBe(200)
      for (const room of [firstRoom, secondRoom]) {
        const [persisted] = await server.app.db.select().from(rooms).where(eq(rooms.id, room.id))
        expect(persisted!.readyAt).not.toBeNull()
        expect(persisted!.lastActivityAt).toEqual(persisted!.readyAt)
        expect(persisted!.updatedAt).toEqual(persisted!.readyAt)
        const members = await server.app.db
          .select()
          .from(roomMembers)
          .where(eq(roomMembers.roomId, room.id))
        expect(members).toHaveLength(2)
        expect(members.find((member) => member.userId !== room.hostId)!.joinedAt).toEqual(
          persisted!.readyAt
        )
        const notifications = await server.app.db
          .select()
          .from(userNotifications)
          .where(eq(userNotifications.roomId, room.id))
        expect(notifications).toHaveLength(2)
        expect(notifications.map((notification) => notification.userId).sort()).toEqual(
          [first!.id, second!.id].sort()
        )
        for (const notification of notifications) expect(notification.type).toBe('room_ready')
      }
    } finally {
      await control.query('ROLLBACK')
      await pending.catch(() => undefined)
    }
  })

  it('lets exactly one of two concurrent joins through when the user holds one free slot', async () => {
    const [player] = await signInMany(server, 1)
    const game = await insertGame(server)
    const hosts = await signInMany(server, ROOM.JOIN_LIMIT + 1)
    const rooms = []
    for (const host of hosts) rooms.push(await createRoom(server, host, { gameId: game.id }))

    const seeded = rooms.slice(0, ROOM.JOIN_LIMIT - 1)
    const targets = rooms.slice(ROOM.JOIN_LIMIT - 1)
    for (const room of seeded) await joinAll(server, room.code, [player!])
    expect(await activeMemberships(player!.id)).toBe(ROOM.JOIN_LIMIT - 1)

    await control.query('BEGIN')
    await control.query('SELECT id FROM rooms WHERE id = ANY($1::uuid[]) FOR UPDATE', [
      targets.map((room) => room.id),
    ])
    const pending = Promise.all(
      targets.map((room) => roomAction(server, player!, room.code, 'join'))
    )
    try {
      await waitForLockedSessions(targets.length)
      await control.query('COMMIT')
      const responses = await withinDeadline(pending, 'Concurrent joins')

      expect(responses.filter((response) => response.statusCode === 200)).toHaveLength(1)
      const rejected = responses.filter((response) => response.statusCode !== 200)
      expect(rejected).toHaveLength(1)
      expect(rejected[0]!.json()).toMatchObject({ error: 'ROOM_JOIN_LIMIT_REACHED' })
      expect(await activeMemberships(player!.id)).toBe(ROOM.JOIN_LIMIT)
    } finally {
      await control.query('ROLLBACK')
      await pending.catch(() => undefined)
    }
  })

  it.each(['create', 'join'] as const)(
    'serializes create and join by the same user with %s reaching the lock first',
    async (first) => {
      const player = await signIn(server)
      const game = await insertGame(server)
      for (let i = 0; i < ROOM.CREATE_LIMIT - 1; i++) {
        await createRoom(server, player, { gameId: game.id })
      }
      const hosts = await signInMany(server, ROOM.JOIN_LIMIT - ROOM.CREATE_LIMIT + 1)
      const targets = []
      for (const host of hosts) targets.push(await createRoom(server, host, { gameId: game.id }))
      for (const room of targets.slice(0, -1)) await joinAll(server, room.code, [player])
      expect(await activeMemberships(player.id)).toBe(ROOM.JOIN_LIMIT - 1)
      expect(await hostedRooms(player.id)).toBe(ROOM.CREATE_LIMIT - 1)

      const target = targets.at(-1)!
      const create = () => postRoom(server, player, { gameId: game.id })
      const join = () => roomAction(server, player, target.code, 'join')
      await control.query('BEGIN')
      await control.query('SELECT id FROM "user" WHERE id = $1 FOR NO KEY UPDATE', [player.id])
      const firstPending = first === 'create' ? create() : join()
      let secondPending: ReturnType<typeof create> | undefined
      try {
        await waitForLockedSessions(1)
        secondPending = first === 'create' ? join() : create()
        await waitForLockedSessions(2)
        await control.query('COMMIT')
        const responses = await withinDeadline(
          Promise.all([firstPending, secondPending]),
          'Concurrent create and join'
        )
        const [created, joined] = first === 'create' ? responses : [responses[1], responses[0]]

        expect(created!.statusCode, created!.body).toBe(201)
        expect(joined!.statusCode, joined!.body).toBe(first === 'create' ? 422 : 200)
        if (first === 'create') {
          expect(joined!.json()).toEqual({
            error: 'ROOM_JOIN_LIMIT_REACHED',
            message: `You can only be in ${ROOM.JOIN_LIMIT} active rooms at a time`,
          })
        }
        // Creation has always enforced only the host limit. If join goes first,
        // the subsequent create is allowed to add a sixth active Membership.
        expect(await activeMemberships(player.id)).toBe(
          ROOM.JOIN_LIMIT + (first === 'join' ? 1 : 0)
        )
        expect(await hostedRooms(player.id)).toBe(ROOM.CREATE_LIMIT)
      } finally {
        await control.query('ROLLBACK')
        await Promise.allSettled([firstPending, secondPending])
      }
    }
  )

  it('reads the lifecycle clock after waiting for the user lock', async () => {
    const player = await signIn(server)
    const game = await insertGame(server)
    const hosts = await signInMany(server, ROOM.JOIN_LIMIT + 1)
    const targets = []
    for (const [index, host] of hosts.entries()) {
      targets.push(
        await createRoom(server, host, {
          gameId: game.id,
          // Seed rooms stay Open; only the target fills up with this join.
          maxPlayers: index === ROOM.JOIN_LIMIT ? 2 : 3,
        })
      )
    }
    for (const room of targets.slice(0, -1)) {
      await joinAll(server, room.code, [player])
    }
    const beforeWait = new Date()
    const clock = new FakeClock(beforeWait)
    for (const room of targets.slice(0, -1)) {
      await setRoomLifecycle(server, room.id, {
        createdAt: beforeWait,
        lastActivityAt: new Date(beforeWait.getTime() - ROOM.OPEN_ROOM_TTL_MS + 1),
        readyAt: null,
      })
    }
    const target = targets.at(-1)!
    const repository = new DrizzleRoomMemberRepository(server.app.db, clock)
    await control.query('BEGIN')
    await control.query('SELECT id FROM "user" WHERE id = $1 FOR NO KEY UPDATE', [player.id])
    const pending = repository.joinOpenRoom({ roomId: target.id, userId: player.id })
    try {
      await waitForLockedSessions(1)
      clock.advance(2)
      await control.query('COMMIT')
      const outcome = await withinDeadline(pending, 'Join waiting for the user lock')

      expect(outcome.status).toBe('joined')
      if (outcome.status !== 'joined') throw new Error('Join did not use the current cutoff')
      expect(outcome.member.joinedAt).toEqual(clock.now())
      expect(outcome.becameReady).toBe(true)
      const row = await findRoomRow(server, target.id)
      expect(row!.readyAt).toEqual(clock.now())
      expect(row!.lastActivityAt).toEqual(clock.now())
      expect(row!.updatedAt).toEqual(clock.now())
    } finally {
      await control.query('ROLLBACK')
      await pending.catch(() => undefined)
    }
  })

  it('lets exactly one of two concurrent creations through when the host holds one free slot', async () => {
    const host = await signIn(server, 'Host')
    const game = await insertGame(server)
    for (let i = 0; i < ROOM.CREATE_LIMIT - 1; i++) {
      await createRoom(server, host, { gameId: game.id })
    }
    expect(await hostedRooms(host.id)).toBe(ROOM.CREATE_LIMIT - 1)

    // SHARE permits the counts but blocks INSERT's ROW EXCLUSIVE table lock.
    // Old code parks both INSERTs after stale counts; serialized code parks
    // one INSERT and one user lock. Both reach this barrier without a timeout.
    await control.query('BEGIN')
    await control.query('LOCK TABLE rooms IN SHARE MODE')
    const pending = Promise.all([
      postRoom(server, host, { gameId: game.id }),
      postRoom(server, host, { gameId: game.id }),
    ])
    try {
      await waitForLockedSessions(2, ['%for update', '%for no key update', 'insert into "rooms"%'])
      await control.query('COMMIT')
      const responses = await withinDeadline(pending, 'Concurrent creations')

      expect(responses.filter((response) => response.statusCode === 201)).toHaveLength(1)
      const rejected = responses.filter((response) => response.statusCode !== 201)
      expect(rejected).toHaveLength(1)
      expect(rejected[0]!.json()).toEqual({
        error: 'ROOM_CREATE_LIMIT_REACHED',
        message: `You can only host ${ROOM.CREATE_LIMIT} active rooms at a time`,
      })
      expect(await hostedRooms(host.id)).toBe(ROOM.CREATE_LIMIT)
    } finally {
      await control.query('ROLLBACK')
      await pending.catch(() => undefined)
    }
  })
})
