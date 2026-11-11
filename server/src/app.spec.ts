import { Writable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp, defaultLogger } from './app'
import type { FastifyInstance } from 'fastify'
import type { Env } from '@config/env'
import { parseEnv } from '@config/env'
import { TEST_AUTH_SECRET } from '@test/harness/test-server'

const SECRET_CODE = 's3cr3t-oauth-code'
const SECRET_STATE = 's3cr3t-oauth-state'
const CALLBACK_URL = `/api/auth/callback/discord?code=${SECRET_CODE}&state=${SECRET_STATE}`

function logEnv(): Env {
  return parseEnv({
    NODE_ENV: 'production',
    // `trace` so the no-leak assertion covers every level the logger can emit.
    LOG_LEVEL: 'trace',
    // Never connected: this spec only exercises database-free routes.
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:1/log-capture',
    BETTER_AUTH_SECRET: TEST_AUTH_SECRET,
    BETTER_AUTH_URL: 'http://localhost:3000',
    CORS_ORIGIN: 'http://localhost:5173',
    DISCORD_CLIENT_ID: 'integration-test-client-id',
    DISCORD_CLIENT_SECRET: 'integration-test-client-secret',
  })
}

interface CapturedLine {
  level: number
  reqId?: string
  req?: { method?: string; url?: string }
  res?: { statusCode?: number }
  responseTime?: number
  msg?: string
}

/**
 * Builds a fully wired app whose logger writes into memory. The logger options
 * come from `defaultLogger` itself (the same wiring the server uses), with
 * `NODE_ENV: 'production'` so no pretty transport competes with the stream.
 */
async function startLogCapture(): Promise<{ app: FastifyInstance; lines: CapturedLine[] }> {
  const env = logEnv()
  const lines: CapturedLine[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as CapturedLine)
      callback()
    },
  })

  const app = await buildApp({ env, logger: { ...defaultLogger(env), stream } })
  await app.ready()
  return { app, lines }
}

/** Asserts a text blob never observed the query string, its values or separators. */
function expectNoQueryLeakIn(text: string): void {
  for (const leak of [SECRET_CODE, SECRET_STATE, '?code=', '?state=', '&state=']) {
    expect(text).not.toContain(leak)
  }
}

describe('server request log (defaultLogger serializer)', () => {
  let capture: { app: FastifyInstance; lines: CapturedLine[] } | undefined
  let consoleErrors: unknown[][]

  beforeEach(() => {
    // Better Auth logs failed state parsing through its own console logger;
    // capture it so no query-string value can slip through that channel either.
    consoleErrors = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      consoleErrors.push(args)
    })
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(async () => {
    if (capture) {
      await capture.app.close()
      capture = undefined
    }
    vi.restoreAllMocks()
  })

  /** Asserts no captured channel observed the query string, its values or separators. */
  function expectNoQueryLeak(): void {
    expectNoQueryLeakIn(JSON.stringify(capture?.lines))
    for (const args of consoleErrors) {
      expectNoQueryLeakIn(String(args))
    }
  }

  it('records path-only requests with unchanged completion data', async () => {
    capture = await startLogCapture()

    const response = await capture.app.inject({ method: 'GET', url: CALLBACK_URL })

    const incoming = capture.lines.filter((line) => line.msg === 'incoming request')
    const completed = capture.lines.filter((line) => line.msg === 'request completed')

    expect(incoming).toHaveLength(1)
    expect(completed).toHaveLength(1)
    expect(incoming[0]?.req).toMatchObject({ method: 'GET', url: '/api/auth/callback/discord' })
    expect(incoming[0]?.reqId).toEqual(expect.any(String))
    expect(completed[0]?.res?.statusCode).toBe(response.statusCode)
    expect(completed[0]?.responseTime).toEqual(expect.any(Number))
    expect(completed[0]?.reqId).toBe(incoming[0]?.reqId)
    expectNoQueryLeak()
  })

  it('never logs the query string or its values on any route at any level', async () => {
    capture = await startLogCapture()

    const health = await capture.app.inject({
      method: 'GET',
      url: `/health?code=${SECRET_CODE}&state=${SECRET_STATE}`,
    })
    const callback = await capture.app.inject({ method: 'GET', url: CALLBACK_URL })

    expect(health.statusCode).toBe(200)
    expect(callback.statusCode).toBeGreaterThan(0)

    const incoming = capture.lines.filter((line) => line.msg === 'incoming request')
    expect(incoming.map((line) => line.req?.url)).toEqual(['/health', '/api/auth/callback/discord'])

    expectNoQueryLeak()
    expectNoQueryLeakIn(JSON.stringify(capture.lines))
  })
})
