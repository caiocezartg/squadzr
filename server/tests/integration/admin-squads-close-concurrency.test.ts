import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import pg from 'pg'
import { eq } from 'drizzle-orm'
import { userNotifications } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import { createRoom, findRoomRow, insertGame, roomAction } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #119: an Admin Closure racing the join that fills the Squad. Both take the Squad's row lock, so one
// wins and the other sees its outcome: a Squad is never Ready and closed at once.

const WAIT_LIMIT_MS = 5_000

let server: TestServer
let control: pg.Client
let moderator: TestUser
let gameId: string

beforeEach(async () => {
  server = await buildTestServer()
  control = new pg.Client({ connectionString: server.databaseUrl })
  await control.connect()
  moderator = await signIn(server, 'Mo Moderator', { role: 'moderator' })
  gameId = (await insertGame(server)).id
})

afterEach(async () => {
  await control.end()
  await server.close()
})

/** Waits until `expected` sessions of this test database are parked on a row lock. */
async function waitForLockedSessions(expected: number): Promise<void> {
  const deadline = performance.now() + WAIT_LIMIT_MS
  while (performance.now() < deadline) {
    await control.query('SELECT pg_stat_clear_snapshot()')
    const { rows } = await control.query<{ waiting: number }>(
      `SELECT count(*)::int AS waiting FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`
    )
    if ((rows[0]?.waiting ?? 0) >= expected) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Not all ${expected} sessions reached the row lock`)
}

describe('an Admin Closure racing the filling join', () => {
  it('never leaves a Ready Squad that also got closure notifications', async () => {
    const [host, joiner] = await Promise.all(['Host', 'Joiner'].map((n) => signIn(server, n)))
    const room = await createRoom(server, host!, { gameId, maxPlayers: 2 })

    // Hold the Squad's row so both writers park on it, then release it and let them race.
    await control.query('BEGIN')
    await control.query('SELECT id FROM rooms WHERE id = $1 FOR UPDATE', [room.id])
    const close = server.app.inject({
      method: 'POST',
      url: `/api/admin/squads/${room.id}/close`,
      headers: moderator.headers,
      payload: { reason: 'Offensive squad name' },
    })
    const join = roomAction(server, joiner!, room.code, 'join')
    await waitForLockedSessions(2)
    await control.query('COMMIT')
    const [closeResponse, joinResponse] = await Promise.all([close, join])

    const row = await findRoomRow(server, room.id)
    const closed = (
      await server.app.db
        .select()
        .from(userNotifications)
        .where(eq(userNotifications.roomId, room.id))
    ).filter((notification) => notification.type === 'room_closed_by_admin')

    if (closeResponse.statusCode === 204) {
      expect(row).toBeNull()
      expect(joinResponse.statusCode).toBe(404)
      expect(closed.map((notification) => notification.userId)).toEqual([host!.id])
    } else {
      expect(closeResponse.statusCode).toBe(422)
      expect(closeResponse.json()).toMatchObject({ error: 'ROOM_NOT_OPEN' })
      expect(joinResponse.statusCode).toBe(200)
      expect(row?.readyAt).not.toBeNull()
      expect(closed).toEqual([])
    }
  })
})
