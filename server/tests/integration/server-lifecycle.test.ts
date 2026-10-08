import { afterEach, describe, expect, inject, it, vi } from 'vitest'
import { count, sql } from 'drizzle-orm'
import pg from 'pg'
import type { WebSocket } from '@fastify/websocket'
import { games } from '@infrastructure/database/schema'
import { buildApp } from '@/app'
import { buildTestServer, createTestEnv, type TestServer } from '@test/harness/test-server'

const servers: TestServer[] = []

async function startServer(): Promise<TestServer> {
  const server = await buildTestServer()
  servers.push(server)
  return server
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  vi.restoreAllMocks()
})

function listeningServers(): number {
  return process.getActiveResourcesInfo().filter((type) => type === 'TCPServerWrap').length
}

async function insertGame(server: TestServer, slug: string): Promise<void> {
  await server.app.db.insert(games).values({
    name: slug,
    slug,
    coverUrl: `https://example.com/${slug}.webp`,
    minPlayers: 2,
    maxPlayers: 5,
  })
}

async function openConnections(databaseUrl: string): Promise<number> {
  const client = new pg.Client({ connectionString: inject('postgres').adminUrl })
  await client.connect()
  try {
    const { rows } = await client.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname = $1',
      [new URL(databaseUrl).pathname.slice(1)]
    )
    return rows[0]?.total ?? 0
  } finally {
    await client.end()
  }
}

async function countGames(server: TestServer): Promise<number> {
  const response = await server.app.inject({ method: 'GET', url: '/api/games' })
  expect(response.statusCode).toBe(200)
  return response.json<{ games: unknown[] }>().games.length
}

describe('server composition', () => {
  it('imports the app modules without starting a listener', async () => {
    const before = listeningServers()

    const { buildApp } = await import('@/app')
    const server = await startServer()

    expect(typeof buildApp).toBe('function')
    expect(server.app.server.listening).toBe(false)
    expect(listeningServers()).toBe(before)
  })

  it('builds and shuts down several isolated instances side by side', async () => {
    const [first, second] = await Promise.all([startServer(), startServer()])

    expect(first.app).not.toBe(second.app)
    expect(first.databaseUrl).not.toBe(second.databaseUrl)

    for (const server of [first, second]) {
      const ready = await server.app.inject({ method: 'GET', url: '/health/ready' })
      expect(ready.statusCode).toBe(200)
    }

    await insertGame(first, 'only-in-first')

    expect(await countGames(first)).toBe(1)
    expect(await countGames(second)).toBe(0)
  })
})

describe('PostgreSQL 16 harness', () => {
  it('runs against PostgreSQL 16 with every migration applied', async () => {
    const server = await startServer()

    const version = await server.app.db.execute<{ server_version_num: string }>(
      sql`SHOW server_version_num`
    )
    const migrations = await server.app.db.execute<{ total: string }>(
      sql`SELECT count(*)::text AS total FROM drizzle.__drizzle_migrations`
    )
    const [gameCount] = await server.app.db.select({ total: count() }).from(games)

    expect(Math.floor(Number(version.rows[0]?.server_version_num) / 10_000)).toBe(16)
    expect(Number(migrations.rows[0]?.total)).toBe(4)
    expect(gameCount?.total).toBe(0)
  })

  it('writes state inside one test', async () => {
    const server = await startServer()
    await insertGame(server, 'leaks-if-not-isolated')

    expect(await countGames(server)).toBe(1)
  })

  it('starts the next test from a clean database', async () => {
    const server = await startServer()

    expect(await countGames(server)).toBe(0)
  })
})

describe('health probes', () => {
  const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
  // Nothing listens on port 1, so the probe's connection is refused at once.
  const UNREACHABLE_DATABASE_URL = 'postgresql://postgres:postgres@localhost:1/unreachable'

  /** The payload all three probes share: status, ISO instant, process uptime and version. */
  function healthPayload(status: 'ok' | 'error') {
    return {
      status,
      timestamp: expect.stringMatching(ISO_TIMESTAMP),
      uptime: expect.any(Number),
      version: '0.1.0',
    }
  }

  it('answers /health with 200 and the ok payload', async () => {
    const server = await startServer()

    const response = await server.app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(healthPayload('ok'))
  })

  it('answers /health/ready with 200 and the ok payload while the database answers', async () => {
    const server = await startServer()

    const response = await server.app.inject({ method: 'GET', url: '/health/ready' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(healthPayload('ok'))
  })

  it('answers /health/ready with 503 and the error payload when the database is down', async () => {
    const app = await buildApp({
      env: createTestEnv({ DATABASE_URL: UNREACHABLE_DATABASE_URL }),
      logger: false,
    })
    await app.ready()
    servers.push({ app, databaseUrl: UNREACHABLE_DATABASE_URL, close: () => app.close() })

    const response = await app.inject({ method: 'GET', url: '/health/ready' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual(healthPayload('error'))
  })
})

describe('shutdown', () => {
  it('closes Fastify, WebSockets, timers and the database pool', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const server = await buildTestServer()
    const intervals = setIntervalSpy.mock.results.map((result) => result.value)

    const socket: WebSocket = await server.app.injectWS('/ws')
    const socketClosed = new Promise<void>((resolve) => socket.once('close', () => resolve()))

    // The pool is lazy: one query guarantees a connection exists to be closed.
    await server.app.db.execute(sql`SELECT 1`)

    expect(intervals.length).toBeGreaterThan(0)
    expect(await openConnections(server.databaseUrl)).toBeGreaterThan(0)

    await server.app.close()
    await socketClosed

    expect(socket.readyState).toBe(socket.CLOSED)
    for (const interval of intervals) {
      expect(clearIntervalSpy).toHaveBeenCalledWith(interval)
    }
    await vi.waitFor(async () => expect(await openConnections(server.databaseUrl)).toBe(0))

    // Dropping without FORCE fails while any connection to the database is still open.
    await server.close()
    await expect(server.app.inject({ method: 'GET', url: '/health' })).rejects.toThrow()
  })
})
