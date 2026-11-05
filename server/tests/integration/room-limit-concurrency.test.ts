import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import pg from 'pg'
import { and, count, eq } from 'drizzle-orm'
import { ROOM } from '@config/constants'
import { roomMembers, rooms } from '@infrastructure/database/schema'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleRoomMemberRepository } from '@infrastructure/repositories/drizzle-room-member.repository'
import { validOpenRoomCondition } from '@infrastructure/repositories/open-room-rules'
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
// The crossed final joins that used to live here are in squad-release-concurrency.
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
        message: `You can only be in ${ROOM.JOIN_LIMIT} open squads at a time`,
      })
    }
    expect(await activeMemberships(player!.id)).toBe(ROOM.JOIN_LIMIT)
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
    let transactionOpen = true
    await control.query('SELECT id FROM rooms WHERE id = ANY($1::uuid[]) FOR UPDATE', [
      targets.map((room) => room.id),
    ])
    const pending = Promise.all(
      targets.map((room) => roomAction(server, player!, room.code, 'join'))
    )
    try {
      await waitForLockedSessions(targets.length)
      await control.query('COMMIT')
      transactionOpen = false
      const responses = await withinDeadline(pending, 'Concurrent joins')

      expect(responses.filter((response) => response.statusCode === 200)).toHaveLength(1)
      const rejected = responses.filter((response) => response.statusCode !== 200)
      expect(rejected).toHaveLength(1)
      expect(rejected[0]!.json()).toMatchObject({ error: 'ROOM_JOIN_LIMIT_REACHED' })
      expect(await activeMemberships(player!.id)).toBe(ROOM.JOIN_LIMIT)
    } finally {
      if (transactionOpen) await control.query('ROLLBACK')
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
      // SHARE pauses the first operation's room write after its user lock.
      // Old code also reaches INSERT/UPDATE after its stale counts, so create
      // first fails through the response/count assertions rather than a timeout.
      await control.query('BEGIN')
      let transactionOpen = true
      await control.query('LOCK TABLE rooms IN SHARE MODE')
      const firstPending = first === 'create' ? create() : join()
      let secondPending: ReturnType<typeof create> | undefined
      try {
        await waitForLockedSessions(1, ['insert into "rooms"%', 'update "rooms"%'])
        secondPending = first === 'create' ? join() : create()
        await waitForLockedSessions(2, [
          '%for no key update',
          'insert into "rooms"%',
          'update "rooms"%',
        ])
        await control.query('COMMIT')
        transactionOpen = false
        const responses = await withinDeadline(
          Promise.all([firstPending, secondPending]),
          'Concurrent create and join'
        )
        const [created, joined] = first === 'create' ? responses : [responses[1], responses[0]]

        // Creation counts Memberships too, so whoever reaches the user lock first takes
        // the last free Membership and the other is refused, in either order.
        const winner = first === 'create' ? created! : joined!
        const loser = first === 'create' ? joined! : created!
        expect(winner.statusCode, winner.body).toBe(first === 'create' ? 201 : 200)
        expect(loser.statusCode, loser.body).toBe(422)
        expect(loser.json()).toEqual({
          error: 'ROOM_JOIN_LIMIT_REACHED',
          message: `You can only be in ${ROOM.JOIN_LIMIT} open squads at a time`,
        })
        expect(await activeMemberships(player.id)).toBe(ROOM.JOIN_LIMIT)
        expect(await hostedRooms(player.id)).toBe(first === 'create' ? ROOM.CREATE_LIMIT : 0)
      } finally {
        if (transactionOpen) await control.query('ROLLBACK')
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
    // FOR UPDATE also blocks the old INSERT's user FK after its clock read.
    // Both implementations reach the barrier; stale cutoff/timestamps then
    // fail the assertions, while production still uses NO KEY UPDATE.
    await control.query('BEGIN')
    let transactionOpen = true
    await control.query('SELECT id FROM "user" WHERE id = $1 FOR UPDATE', [player.id])
    const pending = repository.joinOpenRoom({ roomId: target.id, userId: player.id })
    try {
      await waitForLockedSessions(1, ['%for no key update', 'insert into "room_members"%'])
      clock.advance(2)
      await control.query('COMMIT')
      transactionOpen = false
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
      if (transactionOpen) await control.query('ROLLBACK')
      await pending.catch(() => undefined)
    }
  })

  it('reads the creation clock once after waiting for the user lock', async () => {
    const host = await signIn(server, 'Host')
    const game = await insertGame(server)
    const seeded = []
    for (let i = 0; i < ROOM.CREATE_LIMIT; i++) {
      seeded.push(await createRoom(server, host, { gameId: game.id }))
    }
    const beforeWait = new Date()
    const clock = new FakeClock(beforeWait)
    await setRoomLifecycle(server, seeded[0]!.id, {
      createdAt: beforeWait,
      lastActivityAt: new Date(beforeWait.getTime() - ROOM.OPEN_ROOM_TTL_MS + 1),
      readyAt: null,
    })
    const readClock = vi.spyOn(clock, 'now')
    const repository = new DrizzleRoomRepository(server.app.db, clock)
    await control.query('BEGIN')
    let transactionOpen = true
    await control.query('SELECT id FROM "user" WHERE id = $1 FOR NO KEY UPDATE', [host.id])
    const pending = repository.create({
      name: 'Room after the wait',
      hostId: host.id,
      gameId: game.id,
      maxPlayers: game.maxPlayers,
      discordLink: 'https://discord.gg/test',
    })
    try {
      await waitForLockedSessions(1)
      clock.advance(2)
      await control.query('COMMIT')
      transactionOpen = false
      const outcome = await withinDeadline(pending, 'Create waiting for the user lock')

      expect(outcome.status).toBe('created')
      if (outcome.status !== 'created') throw new Error('Create did not use the current cutoff')
      expect(readClock).toHaveBeenCalledOnce()
      const afterWait = new Date(beforeWait.getTime() + 2)
      expect(outcome.room.createdAt).toEqual(afterWait)
      expect(outcome.room.lastActivityAt).toEqual(afterWait)
      expect(outcome.room.updatedAt).toEqual(afterWait)
      expect(outcome.hostMember.joinedAt).toEqual(afterWait)
      const row = await findRoomRow(server, outcome.room.id)
      expect(row!.createdAt).toEqual(afterWait)
      expect(row!.lastActivityAt).toEqual(afterWait)
      expect(row!.updatedAt).toEqual(afterWait)
      const [member] = await server.app.db
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, outcome.room.id))
      expect(member!.joinedAt).toEqual(afterWait)
    } finally {
      if (transactionOpen) await control.query('ROLLBACK')
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
    let transactionOpen = true
    await control.query('LOCK TABLE rooms IN SHARE MODE')
    const pending = Promise.all([
      postRoom(server, host, { gameId: game.id }),
      postRoom(server, host, { gameId: game.id }),
    ])
    try {
      await waitForLockedSessions(2, ['%for update', '%for no key update', 'insert into "rooms"%'])
      await control.query('COMMIT')
      transactionOpen = false
      const responses = await withinDeadline(pending, 'Concurrent creations')

      expect(responses.filter((response) => response.statusCode === 201)).toHaveLength(1)
      const rejected = responses.filter((response) => response.statusCode !== 201)
      expect(rejected).toHaveLength(1)
      expect(rejected[0]!.json()).toEqual({
        error: 'ROOM_CREATE_LIMIT_REACHED',
        message: 'You can only host 1 open squad at a time',
      })
      expect(await hostedRooms(host.id)).toBe(ROOM.CREATE_LIMIT)
    } finally {
      if (transactionOpen) await control.query('ROLLBACK')
      await pending.catch(() => undefined)
    }
  })
})
