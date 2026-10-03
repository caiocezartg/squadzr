import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import pg from 'pg'
import { and, count, eq } from 'drizzle-orm'
import { ROOM } from '@config/constants'
import { roomMembers, rooms } from '@infrastructure/database/schema'
import { validOpenRoomCondition } from '@infrastructure/repositories/drizzle-room.repository'
import { signIn, signInMany } from '@test/harness/auth'
import { createRoom, insertGame, joinAll, postRoom, roomAction } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-53: the per-user Membership limit and the per-host room limit are decided
// inside the transaction that writes the row, under a lock on the user row.
// These tests force the race with a lock barrier: the control transaction holds
// the rows every request needs, the requests park on those row locks, and the
// barrier is released only after all of them are waiting. Without the
// in-transaction check, every request passes the limit before any of them
// writes, and more than the limit commits. Concurrent joins by one user into
// different rooms park on different room locks and then serialize on the same
// user lock; the explicit deadline proves that order cannot deadlock.

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
 * Waits until `expected` sessions of this test database are parked on a row
 * lock. PostgreSQL caches activity snapshots until the control transaction ends.
 */
async function waitForLockedSessions(expected: number): Promise<void> {
  const deadline = performance.now() + COMPLETION_LIMIT_MS
  while (performance.now() < deadline) {
    await control.query('SELECT pg_stat_clear_snapshot()')
    const { rows } = await control.query<{ waiting: number }>(`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE '%for update'
    `)
    if ((rows[0]?.waiting ?? 0) >= expected) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Not all ${expected} sessions reached the row lock`)
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

      for (const response of responses) {
        expect(response.statusCode, response.body).toBe(422)
        expect(response.json()).toEqual({
          error: 'ROOM_JOIN_LIMIT_REACHED',
          message: `You can only be in ${ROOM.JOIN_LIMIT} active rooms at a time`,
        })
      }
      expect(await activeMemberships(player!.id)).toBe(ROOM.JOIN_LIMIT)
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

  it('lets exactly one of two concurrent creations through when the host holds one free slot', async () => {
    const host = await signIn(server, 'Host')
    const game = await insertGame(server)
    for (let i = 0; i < ROOM.CREATE_LIMIT - 1; i++) {
      await createRoom(server, host, { gameId: game.id })
    }
    expect(await hostedRooms(host.id)).toBe(ROOM.CREATE_LIMIT - 1)

    // Locking the user row parks both creations before their count, exactly
    // where the in-transaction limit now lives; the old out-of-transaction
    // count would already have passed for both of them.
    await control.query('BEGIN')
    await control.query('SELECT id FROM "user" WHERE id = $1 FOR UPDATE', [host.id])
    const pending = Promise.all([
      postRoom(server, host, { gameId: game.id }),
      postRoom(server, host, { gameId: game.id }),
    ])
    try {
      await waitForLockedSessions(2)
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
