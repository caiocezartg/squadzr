import { afterEach, describe, expect, it } from 'vitest'
import { errorResponseSchema } from '@squadzr/schemas'
import { signIn } from '@test/harness/auth'
import { createLogCapture } from '@test/harness/logging'
import { connect } from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// Abuse limits: every route is limited per client address, the health checks and a route with its own
// limit aside, and the socket route has tighter ones. Behind the origin lock the address is the visitor's.

const HEADER = 'x-squadzr-edge-auth'
const TOKEN = 'edge-secret-0123456789abcdef-0123456789'
const RAILWAY_EDGE = '100.64.0.1'

let server: TestServer | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

/** A GET that reaches Fastify as Railway's edge forwards it for `address`. */
function getFrom(address: string, url = '/api/rooms', headers: Record<string, string> = {}) {
  return server!.app.inject({
    method: 'GET',
    url,
    remoteAddress: RAILWAY_EDGE,
    headers: { 'x-forwarded-for': address, ...headers },
  })
}

async function statuses(address: string, count: number, url?: string) {
  const codes: number[] = []
  for (let i = 0; i < count; i += 1) codes.push((await getFrom(address, url)).statusCode)
  return codes
}

describe('the limit on every route', () => {
  it('answers 429 RATE_LIMITED past the limit, with Retry-After, and counts each address apart', async () => {
    server = await buildTestServer({ RATE_LIMIT_MAX: 3, RATE_LIMIT_WINDOW_MS: 60_000 })

    expect(await statuses('203.0.113.1', 3)).toEqual([200, 200, 200])
    const limited = await getFrom('203.0.113.1')

    expect(limited.statusCode).toBe(429)
    expect(errorResponseSchema.parse(limited.json())).toMatchObject({ error: 'RATE_LIMITED' })
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0)
    expect((await getFrom('203.0.113.2')).statusCode).toBe(200)
  })

  it('counts every address of an IPv6 /64 together', async () => {
    server = await buildTestServer({ RATE_LIMIT_MAX: 2 })

    await getFrom('2804:1b3:aa80:d188::1')
    await getFrom('2804:1b3:aa80:d188::2')

    expect((await getFrom('2804:1b3:aa80:d188::3')).statusCode).toBe(429)
    expect((await getFrom('2804:1b3:aa80:d189::1')).statusCode).toBe(200)
  })

  it('never limits the health checks', async () => {
    server = await buildTestServer({ RATE_LIMIT_MAX: 1 })

    expect(await statuses('203.0.113.3', 4, '/health')).toEqual([200, 200, 200, 200])
    expect(await statuses('203.0.113.3', 4, '/health/ready')).toEqual([200, 200, 200, 200])
    // The probes did not spend the address's quota either.
    expect((await getFrom('203.0.113.3')).statusCode).toBe(200)
  })

  it('does not limit at all when RATE_LIMIT_MAX is 0', async () => {
    server = await buildTestServer({ RATE_LIMIT_MAX: 0 })

    expect(new Set(await statuses('203.0.113.4', 8))).toEqual(new Set([200]))
  })

  it('limits behind the origin lock by the visitor address, not the Cloudflare one', async () => {
    server = await buildTestServer({ RATE_LIMIT_MAX: 2, EDGE_AUTH_TOKEN: TOKEN })
    const through = (visitor: string) =>
      getFrom('172.69.0.1', '/api/rooms', { [HEADER]: TOKEN, 'cf-connecting-ip': visitor })

    expect((await through('203.0.113.10')).statusCode).toBe(200)
    expect((await through('203.0.113.10')).statusCode).toBe(200)
    expect((await through('203.0.113.10')).statusCode).toBe(429)
    expect((await through('203.0.113.11')).statusCode).toBe(200)
  })

  it('refuses a request without the secret before it spends any quota', async () => {
    server = await buildTestServer({ RATE_LIMIT_MAX: 1, EDGE_AUTH_TOKEN: TOKEN })

    expect((await getFrom('203.0.113.12')).statusCode).toBe(403)
    expect((await getFrom('203.0.113.12')).statusCode).toBe(403)
  })
})

describe('the Discord invite check', () => {
  it('keeps its own per-user limit next to the per-address one', async () => {
    server = await buildTestServer(
      { RATE_LIMIT_MAX: 1_000 },
      { discordInviteRateLimit: { max: 2, timeWindowMs: 60_000 } }
    )
    const first = await signIn(server, 'First')
    const second = await signIn(server, 'Second')
    const check = (user: { headers: { cookie: string } }) =>
      server!.app.inject({
        method: 'GET',
        url: '/api/discord/invites/valorant',
        remoteAddress: RAILWAY_EDGE,
        headers: { 'x-forwarded-for': '203.0.113.20', ...user.headers },
      })

    expect((await check(first)).statusCode).toBe(200)
    expect((await check(first)).statusCode).toBe(200)
    expect((await check(first)).statusCode).toBe(429)
    // Same address, other user: their own quota.
    expect((await check(second)).statusCode).toBe(200)
  })

  it('still answers 401 to an anonymous request without spending anyone a check', async () => {
    server = await buildTestServer(
      { RATE_LIMIT_MAX: 1_000 },
      { discordInviteRateLimit: { max: 1, timeWindowMs: 60_000 } }
    )
    const user = await signIn(server, 'Player')
    const url = '/api/discord/invites/valorant'

    expect((await server.app.inject({ method: 'GET', url })).statusCode).toBe(401)
    expect((await server.app.inject({ method: 'GET', url })).statusCode).toBe(401)
    expect(
      (await server.app.inject({ method: 'GET', url, headers: user.headers })).statusCode
    ).toBe(200)
  })
})

describe('the socket route', () => {
  // An in-memory socket has no address of its own: give it one.
  const upgrade = () =>
    server!.app.injectWS('/ws', { socket: { remoteAddress: '203.0.113.50' } } as never)

  it('refuses an upgrade past the per-minute limit', async () => {
    server = await buildTestServer({ WS_UPGRADES_PER_MINUTE: 2 })

    const first = await upgrade()
    const second = await upgrade()
    first.close()
    second.close()

    await expect(upgrade()).rejects.toThrow()
  })

  it('turns a socket past the per-address cap away, and takes one again once one closes', async () => {
    const capture = createLogCapture('warn')
    server = await buildTestServer({ WS_MAX_CONNECTIONS_PER_IP: 2 }, { logger: capture.logger })

    const first = await connect(server)
    const second = await connect(server)

    // The third is accepted and closed at once: it never gets the protocol greeting.
    const third = await server.app.injectWS('/ws', {})
    const received: unknown[] = []
    third.on('message', (data: Buffer) => received.push(data.toString()))
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(received).toEqual([])
    expect(capture.lines.join('\n')).toContain('WebSocket connection limit exceeded')

    first.client.close()
    await first.serverClosed
    const fourth = await connect(server)

    expect(fourth.protocol.type).toBe('protocol')
    second.client.close()
    fourth.client.close()
  })

  it('does not limit sockets or upgrades when both are 0', async () => {
    server = await buildTestServer()

    const sessions = [await connect(server), await connect(server), await connect(server)]

    for (const session of sessions) session.client.close()
  })
})

describe('the Worker zone', () => {
  it('is logged on a request that carries the secret, and ignored when it is not a zone name', async () => {
    const capture = createLogCapture('info')
    server = await buildTestServer({ EDGE_AUTH_TOKEN: TOKEN }, { logger: capture.logger })

    for (const zone of ['squadzr.app', 'not a zone']) {
      await getFrom('203.0.113.30', '/api/rooms', {
        [HEADER]: TOKEN,
        'x-squadzr-worker-zone': zone,
      })
    }
    await getFrom('203.0.113.30', '/api/rooms', { [HEADER]: TOKEN })

    const completed = capture.lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => line.msg === 'request completed')
    expect(completed).toEqual([
      expect.objectContaining({ workerZone: 'squadzr.app' }),
      expect.not.objectContaining({ workerZone: expect.anything() }),
      expect.not.objectContaining({ workerZone: expect.anything() }),
    ])
  })

  it('is not believed without the secret: the request is refused', async () => {
    server = await buildTestServer({ EDGE_AUTH_TOKEN: TOKEN })

    const response = await getFrom('203.0.113.31', '/api/rooms', {
      'x-squadzr-worker-zone': 'squadzr.app',
    })

    expect(response.statusCode).toBe(403)
  })
})
