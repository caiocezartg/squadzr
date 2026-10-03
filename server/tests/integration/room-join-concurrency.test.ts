import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { JoinRoomUseCase } from '@application/use-cases/room/join-room.use-case'
import { RoomFullError } from '@application/errors'
import * as schema from '@infrastructure/database/schema'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleRoomMemberRepository } from '@infrastructure/repositories/drizzle-room-member.repository'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import { signIn, signInMany } from '@test/harness/auth'
import { createRoom, insertGame } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

const POOL_SIZE = 10
const JOIN_COUNT = 12
const COMPLETION_LIMIT_MS = 5_000

let server: TestServer
let pool: pg.Pool
let control: pg.Client
let join: JoinRoomUseCase

beforeEach(async () => {
  server = await buildTestServer()
  pool = new pg.Pool({
    connectionString: server.databaseUrl,
    max: POOL_SIZE,
    // Only a cleanup guard: an exhausted pool must fail the shorter completion
    // deadline first, then release pending work so the test can close cleanly.
    connectionTimeoutMillis: COMPLETION_LIMIT_MS + 1_000,
  })
  const db = drizzle(pool, { schema })
  join = new JoinRoomUseCase(
    new DrizzleRoomRepository(db),
    new DrizzleRoomMemberRepository(db, server.app.clock),
    new DrizzleGameRepository(db),
    server.app.clock
  )
  control = new pg.Client({ connectionString: server.databaseUrl })
  await control.connect()
})

afterEach(async () => {
  await control.end()
  await pool.end()
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

async function waitForFullPool(): Promise<void> {
  const deadline = performance.now() + COMPLETION_LIMIT_MS
  while (performance.now() < deadline) {
    // PostgreSQL caches activity snapshots until this control transaction ends.
    await control.query('SELECT pg_stat_clear_snapshot()')
    const { rows } = await control.query<{ waiting: number }>(`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE '%for update'
    `)
    if (rows[0]?.waiting === POOL_SIZE) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Pool saturation barrier did not fill all connections')
}

async function runJoins(inputs: { code: string; userId: string; roomId: string }[]) {
  await control.query('BEGIN')
  await control.query('SELECT id FROM rooms WHERE id = ANY($1::uuid[]) FOR UPDATE', [
    inputs.map((input) => input.roomId),
  ])
  const pending = Promise.allSettled(inputs.map((input) => join.execute(input)))
  try {
    // Every pool connection is now in a real join transaction waiting for a
    // room lock. Releasing the locks exposes any nested pool query reliably.
    await waitForFullPool()
    expect(pool.totalCount).toBe(POOL_SIZE)
    await control.query('COMMIT')
    return await withinDeadline(pending, 'Concurrent joins')
  } finally {
    await control.query('ROLLBACK')
    await pending
  }
}

describe('join transactions under pool saturation', () => {
  it('finishes twelve joins for one last seat without acquiring another connection', async () => {
    const host = await signIn(server, 'Host')
    const players = await signInMany(server, JOIN_COUNT)
    const game = await insertGame(server)
    const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 2 })

    const outcomes = await runJoins(
      players.map((player) => ({ code: room.code, roomId: room.id, userId: player.id }))
    )

    const successes = outcomes.filter((outcome) => outcome.status === 'fulfilled')
    const failures = outcomes.filter((outcome) => outcome.status === 'rejected')
    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(JOIN_COUNT - 1)
    for (const failure of failures) expect(failure.reason).toBeInstanceOf(RoomFullError)
    const winner = successes[0]!.value
    expect(winner.isRoomNowFull).toBe(true)
    expect(winner.createdNotifications).toHaveLength(2)
    const player = players.find((candidate) => candidate.id === winner.roomMember.userId)!
    for (const notification of winner.createdNotifications) {
      expect(notification.payload.players).toEqual(
        expect.arrayContaining([
          { name: host.name, image: host.image },
          { name: player.name, image: player.image },
        ])
      )
      expect(notification.payload.players).toHaveLength(2)
    }
  })

  it('finishes twelve final joins in different rooms without acquiring another connection', async () => {
    const hosts = await signInMany(server, JOIN_COUNT)
    const players = await signInMany(server, JOIN_COUNT)
    const game = await insertGame(server)
    const rooms = await Promise.all(
      hosts.map((host) => createRoom(server, host, { gameId: game.id, maxPlayers: 2 }))
    )

    const outcomes = await runJoins(
      rooms.map((room, index) => ({
        code: room.code,
        roomId: room.id,
        userId: players[index]!.id,
      }))
    )

    for (const [index, outcome] of outcomes.entries()) {
      expect(outcome.status).toBe('fulfilled')
      if (outcome.status !== 'fulfilled') throw new Error('Final join failed')
      expect(outcome.value.isRoomNowFull).toBe(true)
      expect(outcome.value.createdNotifications).toHaveLength(2)
      for (const notification of outcome.value.createdNotifications) {
        expect(notification.payload.players).toEqual(
          expect.arrayContaining([
            { name: hosts[index]!.name, image: hosts[index]!.image },
            { name: players[index]!.name, image: players[index]!.image },
          ])
        )
        expect(notification.payload.players).toHaveLength(2)
      }
    }
    const notifications = await server.app.db.select().from(schema.userNotifications)
    expect(notifications).toHaveLength(JOIN_COUNT * 2)
  })
})
