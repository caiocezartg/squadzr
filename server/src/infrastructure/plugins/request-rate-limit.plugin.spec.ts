import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import edgeGuardPlugin from './edge-guard.plugin'
import requestRateLimitPlugin from './request-rate-limit.plugin'

// The limit every route has, on a bare Fastify instance (no database): per address, health checks aside,
// replaced by a route's own limit, and counting the visitor behind the origin lock.

const TOKEN = 'edge-secret-0123456789abcdef-0123456789'
const RAILWAY_EDGE = '100.64.0.1'

let app: FastifyInstance | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

async function build(options: { max: number; token?: string }) {
  app = Fastify({ trustProxy: 1 })
  await app.register(edgeGuardPlugin, { token: options.token })
  await app.register(requestRateLimitPlugin, { max: options.max, windowMs: 60_000 })
  app.get('/api/things', async () => ({ ok: true }))
  app.get('/health', async () => ({ status: 'ok' }))
  app.get('/health/ready', async () => ({ status: 'ok' }))
  // A route with its own limit, checked in `preHandler` and keyed on a header standing in for the user.
  app.get(
    '/api/own',
    {
      config: {
        rateLimit: {
          hook: 'preHandler',
          max: 2,
          timeWindow: 60_000,
          keyGenerator: (request) => String(request.headers['x-user'] ?? request.ip),
        },
      },
    },
    async () => ({ ok: true })
  )
  await app.ready()
  return app
}

function get(url: string, address: string, headers: Record<string, string> = {}) {
  return app!.inject({
    method: 'GET',
    url,
    remoteAddress: RAILWAY_EDGE,
    headers: { 'x-forwarded-for': address, ...headers },
  })
}

describe('the limit on every route', () => {
  it('answers 429 RATE_LIMITED past the limit and counts each address apart', async () => {
    await build({ max: 3 })

    for (let i = 0; i < 3; i += 1)
      expect((await get('/api/things', '203.0.113.1')).statusCode).toBe(200)
    const limited = await get('/api/things', '203.0.113.1')

    expect(limited.statusCode).toBe(429)
    expect(limited.json()).toMatchObject({ code: 'RATE_LIMITED' })
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0)
    expect((await get('/api/things', '203.0.113.2')).statusCode).toBe(200)
  })

  it('counts every address of an IPv6 /64 together', async () => {
    await build({ max: 2 })

    await get('/api/things', '2804:1b3:aa80:d188::1')
    await get('/api/things', '2804:1b3:aa80:d188::2')

    expect((await get('/api/things', '2804:1b3:aa80:d188::3')).statusCode).toBe(429)
    expect((await get('/api/things', '2804:1b3:aa80:d189::1')).statusCode).toBe(200)
  })

  it('never limits or counts the health checks', async () => {
    await build({ max: 1 })

    for (let i = 0; i < 4; i += 1) {
      expect((await get('/health', '203.0.113.3')).statusCode).toBe(200)
      expect((await get('/health/ready', '203.0.113.3')).statusCode).toBe(200)
    }
    expect((await get('/api/things', '203.0.113.3')).statusCode).toBe(200)
  })

  it('does not limit when the maximum is 0', async () => {
    await build({ max: 0 })

    for (let i = 0; i < 8; i += 1)
      expect((await get('/api/things', '203.0.113.4')).statusCode).toBe(200)
  })

  it('lets a route with its own limit keep it, keyed on its own key', async () => {
    await build({ max: 1_000 })
    const as = (user: string) => get('/api/own', '203.0.113.5', { 'x-user': user })

    expect((await as('ada')).statusCode).toBe(200)
    expect((await as('ada')).statusCode).toBe(200)
    expect((await as('ada')).statusCode).toBe(429)
    // The same address, another user: their own quota.
    expect((await as('grace')).statusCode).toBe(200)
  })

  it('counts the visitor, not the Cloudflare address, behind the origin lock', async () => {
    await build({ max: 2, token: TOKEN })
    const through = (visitor: string) =>
      get('/api/things', '172.69.0.1', {
        'x-squadzr-edge-auth': TOKEN,
        'cf-connecting-ip': visitor,
      })

    expect((await through('203.0.113.10')).statusCode).toBe(200)
    expect((await through('203.0.113.10')).statusCode).toBe(200)
    expect((await through('203.0.113.10')).statusCode).toBe(429)
    expect((await through('203.0.113.11')).statusCode).toBe(200)
  })

  it('refuses a request without the secret before it spends any quota', async () => {
    await build({ max: 1, token: TOKEN })

    expect((await get('/api/things', '203.0.113.12')).statusCode).toBe(403)
    expect((await get('/api/things', '203.0.113.12')).statusCode).toBe(403)
  })
})

describe('a WebSocket upgrade', () => {
  it('is refused with 429 past the limit of its own route, counting the address of the socket', async () => {
    app = Fastify({ trustProxy: 1 })
    await app.register(requestRateLimitPlugin, { max: 0, windowMs: 60_000 })
    await app.register(websocket)
    app.get(
      '/ws',
      { websocket: true, config: { rateLimit: { max: 2, timeWindow: 60_000 } } },
      () => undefined
    )
    await app.ready()
    // An in-memory socket has no address of its own: give it one.
    const upgrade = () =>
      app!.injectWS('/ws', { socket: { remoteAddress: '203.0.113.60' } } as never)

    const first = await upgrade()
    const second = await upgrade()
    first.close()
    second.close()

    await expect(upgrade()).rejects.toThrow('Unexpected server response: 429')
  })
})
