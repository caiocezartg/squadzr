import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import pg from 'pg'
import { count, eq } from 'drizzle-orm'
import { roomMembers, rooms, userNotifications } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import { createRoom, findRoomRow, insertGame, postRoom, roomAction } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'
import type { RoomDto } from '@squadzr/schemas'

// #112: Squad Releases that overlap. The deadlock between two Squads that fill at once with
// a member in common, and a `create` racing the release that could make its author a host.
// Barriers hold the transactions after their first locks, so the interleaving is not luck.

const COMPLETION_LIMIT_MS = 5_000
const BARRIER_KEY = 112

let server: TestServer
let control: pg.Client
let gameId: string

beforeEach(async () => {
  server = await buildTestServer()
  control = new pg.Client({ connectionString: server.databaseUrl })
  await control.connect()
  gameId = (await insertGame(server)).id
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

/** Waits until `expected` sessions of this test database are parked on a lock. */
async function waitForLockedSessions(expected: number, queryPatterns: string[]): Promise<void> {
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

async function squad(host: TestUser, maxPlayers: number): Promise<RoomDto> {
  return createRoom(server, host, { gameId, maxPlayers })
}

async function join(user: TestUser, room: RoomDto): Promise<void> {
  const response = await roomAction(server, user, room.code, 'join')
  expect(response.statusCode, response.body).toBe(200)
}

async function memberIds(room: RoomDto): Promise<string[]> {
  const rows = await server.app.db
    .select({ userId: roomMembers.userId })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, room.id))
  return rows.map((row) => row.userId).sort()
}

async function hostedSquads(hostId: string): Promise<number> {
  const [row] = await server.app.db
    .select({ total: count() })
    .from(rooms)
    .where(eq(rooms.hostId, hostId))
  return row?.total ?? 0
}

async function notificationTypes(userId: string): Promise<string[]> {
  const rows = await server.app.db
    .select({ type: userNotifications.type })
    .from(userNotifications)
    .where(eq(userNotifications.userId, userId))
  return rows.map((row) => row.type)
}

describe('two Squads that fill at once with a member in common', () => {
  it('finishes both joins: the loser of the deadlock runs again and the common member stays only in the first', async () => {
    const [hostA, hostB, common, finalA, finalB] = await Promise.all(
      ['Host A', 'Host B', 'Common', 'Final A', 'Final B'].map((name) => signIn(server, name))
    )
    const a = await squad(hostA!, 3)
    const b = await squad(hostB!, 3)
    await join(common!, a)
    await join(common!, b)

    // Both final joins pause when they mark their Squad Ready, each already holding its
    // own room lock. Released together, each then asks for the other's room: a deadlock.
    await control.query(`
      CREATE FUNCTION pause_ready_update() RETURNS trigger AS $$
      BEGIN
        IF NEW.ready_at IS NOT NULL AND OLD.ready_at IS NULL THEN
          PERFORM pg_advisory_xact_lock_shared(${BARRIER_KEY});
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER pause_ready_update BEFORE UPDATE ON rooms
      FOR EACH ROW EXECUTE FUNCTION pause_ready_update();
    `)
    await control.query('BEGIN')
    let transactionOpen = true
    await control.query(`SELECT pg_advisory_xact_lock(${BARRIER_KEY})`)
    const pending = Promise.all([
      roomAction(server, finalA!, a.code, 'join'),
      roomAction(server, finalB!, b.code, 'join'),
    ])
    try {
      await waitForLockedSessions(2, ['update "rooms"%'])
      await control.query('COMMIT')
      transactionOpen = false
      const responses = await withinDeadline(pending, 'Crossed Squad Releases')

      for (const response of responses) expect(response.statusCode, response.body).toBe(200)
      const [rowA, rowB] = [await findRoomRow(server, a.id), await findRoomRow(server, b.id)]
      expect(Boolean(rowA!.readyAt) !== Boolean(rowB!.readyAt), 'exactly one Squad is Ready').toBe(
        true
      )
      const [readyOne, openOne] = rowA!.readyAt ? [a, b] : [b, a]

      expect(await memberIds(readyOne)).toHaveLength(3)
      expect(await memberIds(readyOne)).toContain(common!.id)
      // The other Squad lost the common member and kept the seat of its own final joiner.
      const stayers = await memberIds(openOne)
      expect(stayers).not.toContain(common!.id)
      expect(stayers).toHaveLength(2)
      expect(await hostedSquads(hostA!.id)).toBe(1)
      expect(await hostedSquads(hostB!.id)).toBe(1)
    } finally {
      if (transactionOpen) await control.query('ROLLBACK')
      await pending.catch(() => undefined)
    }
  })
})

describe('a create racing the Squad Release', () => {
  /**
   * `owner` hosts B and joins the Squad that fills; `heir` is the only other member of B.
   * The control connection holds the heir's user row, so both the heir's `create` and the
   * release (which needs that row to know whether the heir already hosts) queue behind it.
   */
  async function raceOnHeir(first: 'create' | 'release') {
    const [hostA, owner, heir] = await Promise.all(
      ['Host A', 'Owner', 'Heir'].map((name) => signIn(server, name))
    )
    const a = await squad(hostA!, 2)
    const b = await squad(owner!, 3)
    await join(heir!, b)

    await control.query('BEGIN')
    let transactionOpen = true
    await control.query('SELECT id FROM "user" WHERE id = $1 FOR NO KEY UPDATE', [heir!.id])
    const create = () => postRoom(server, heir!, { gameId })
    const release = () => roomAction(server, owner!, a.code, 'join')
    const firstPending = first === 'create' ? create() : release()
    let secondPending: ReturnType<typeof create> | undefined
    try {
      await waitForLockedSessions(1, ['%for no key update'])
      secondPending = first === 'create' ? release() : create()
      await waitForLockedSessions(2, ['%for no key update'])
      await control.query('COMMIT')
      transactionOpen = false
      const responses = await withinDeadline(
        Promise.all([firstPending, secondPending]),
        'Create racing the release'
      )
      const [created, released] = first === 'create' ? responses : [responses[1]!, responses[0]!]
      return { a, b, heir: heir!, owner: owner!, created: created!, released: released! }
    } finally {
      if (transactionOpen) await control.query('ROLLBACK')
      await Promise.allSettled([firstPending, secondPending])
    }
  }

  it('closes the Squad when the heir created a Squad first, so the heir hosts exactly one', async () => {
    const { b, heir, created, released } = await raceOnHeir('create')

    expect(created.statusCode, created.body).toBe(201)
    expect(released.statusCode, released.body).toBe(200)
    expect(await findRoomRow(server, b.id)).toBeNull()
    expect(await hostedSquads(heir.id)).toBe(1)
    expect(await notificationTypes(heir.id)).toEqual(['room_closed'])
  })

  it('refuses the create when the release made the heir host first, so the heir hosts exactly one', async () => {
    const { b, heir, created, released } = await raceOnHeir('release')

    expect(released.statusCode, released.body).toBe(200)
    expect(created.statusCode, created.body).toBe(422)
    expect(created.json()).toMatchObject({ error: 'ROOM_CREATE_LIMIT_REACHED' })
    expect((await findRoomRow(server, b.id))?.hostId).toBe(heir.id)
    expect(await hostedSquads(heir.id)).toBe(1)
    expect(await notificationTypes(heir.id)).toEqual(['host_transferred'])
  })
})
