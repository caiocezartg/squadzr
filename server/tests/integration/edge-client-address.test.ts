import { afterEach, describe, expect, it } from 'vitest'
import { createLogCapture } from '@test/harness/logging'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// Behind Cloudflare the proxy chain only names a Cloudflare address: the Railway edge replaces
// x-forwarded-for with the address that connected to it. The visitor's address is CF-Connecting-IP,
// believed only on a request that carries the edge secret. Better Auth's sign-in limit (production, 3 per
// window) and the request log are the consumers observed here.

const HEADER = 'x-squadzr-edge-auth'
const TOKEN = 'edge-secret-0123456789abcdef-0123456789'
const RAILWAY_EDGE = '100.64.0.1'
const CLOUDFLARE = '172.69.138.8'

// Better Auth keeps its rate-limit counters in memory shared by every server of the process, so each test
// that exhausts a quota does it for an address of its own.

let server: TestServer | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

function signIn(headers: Record<string, string>, proxyChainAddress = CLOUDFLARE) {
  return server!.app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/social',
    remoteAddress: RAILWAY_EDGE,
    headers: { 'x-forwarded-for': proxyChainAddress, ...headers },
    payload: { provider: 'discord', callbackURL: 'http://localhost:5173/squads' },
  })
}

async function statuses(
  headersOf: (attempt: number) => Record<string, string>,
  proxyChainAddress = CLOUDFLARE,
  attempts = 4
) {
  const codes: number[] = []
  for (let attempt = 0; attempt < attempts; attempt++) {
    codes.push((await signIn(headersOf(attempt), proxyChainAddress)).statusCode)
  }
  return codes
}

describe('with the lock on', () => {
  it('limits sign-in by CF-Connecting-IP: one visitor is limited, others are not', async () => {
    server = await buildTestServer({ NODE_ENV: 'production', EDGE_AUTH_TOKEN: TOKEN })

    const sameVisitor = await statuses(() => ({
      [HEADER]: TOKEN,
      'cf-connecting-ip': '203.0.113.9',
    }))
    const otherVisitors = await statuses((attempt) => ({
      [HEADER]: TOKEN,
      'cf-connecting-ip': `203.0.113.${100 + attempt}`,
    }))

    expect(sameVisitor.slice(0, 3)).not.toContain(429)
    expect(sameVisitor[3]).toBe(429)
    expect(otherVisitors).not.toContain(429)
  })

  it('counts an IPv6 visitor too', async () => {
    server = await buildTestServer({ NODE_ENV: 'production', EDGE_AUTH_TOKEN: TOKEN })

    const codes = await statuses(() => ({
      [HEADER]: TOKEN,
      'cf-connecting-ip': '2804:1b3:aa80:d188:64ed:92bf:8a0f:2787',
    }))

    expect(codes[3]).toBe(429)
  })

  it('falls back to the proxy chain address when CF-Connecting-IP is not an address', async () => {
    server = await buildTestServer({ NODE_ENV: 'production', EDGE_AUTH_TOKEN: TOKEN })

    // A different invalid value each time: they cannot be told apart, so all share the Cloudflare address.
    const codes = await statuses(
      (attempt) => ({ [HEADER]: TOKEN, 'cf-connecting-ip': `not-an-ip-${attempt}` }),
      '172.69.0.1'
    )

    expect(codes[3]).toBe(429)
  })

  it('refuses a request with a forged CF-Connecting-IP and no secret', async () => {
    server = await buildTestServer({ NODE_ENV: 'production', EDGE_AUTH_TOKEN: TOKEN })

    const response = await signIn({ 'cf-connecting-ip': '203.0.113.9' })

    expect(response.statusCode).toBe(403)
  })

  it('logs the visitor address on the request, and warns without the token on a bad header', async () => {
    const capture = createLogCapture('info')
    server = await buildTestServer({ EDGE_AUTH_TOKEN: TOKEN }, { logger: capture.logger })

    for (const address of ['203.0.113.9', 'garbage']) {
      await server.app.inject({
        method: 'GET',
        url: '/api/rooms',
        remoteAddress: RAILWAY_EDGE,
        headers: { 'x-forwarded-for': CLOUDFLARE, [HEADER]: TOKEN, 'cf-connecting-ip': address },
      })
    }

    const lines = capture.lines.map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(lines.filter((line) => line.msg === 'request completed')).toEqual([
      expect.objectContaining({ clientIp: '203.0.113.9' }),
      expect.not.objectContaining({ clientIp: expect.anything() }),
    ])
    expect(lines.filter((line) => line.level === 40)).toEqual([
      expect.objectContaining({
        msg: 'Authenticated edge request without a usable CF-Connecting-IP',
        cfConnectingIp: 'invalid',
      }),
    ])
    expect(capture.lines.join('\n')).not.toContain(TOKEN)
  })
})

describe('with the lock off', () => {
  it('ignores a forged CF-Connecting-IP: the proxy chain address is the visitor', async () => {
    server = await buildTestServer({ NODE_ENV: 'production' })

    const codes = await statuses(
      (attempt) => ({ 'cf-connecting-ip': `203.0.113.${attempt}` }),
      '172.69.0.2'
    )

    expect(codes.slice(0, 3)).not.toContain(429)
    expect(codes[3]).toBe(429)
  })

  it('does not adopt the address even when a header named like the secret is sent', async () => {
    server = await buildTestServer({ NODE_ENV: 'production' })

    const codes = await statuses(
      (attempt) => ({ [HEADER]: TOKEN, 'cf-connecting-ip': `203.0.113.${attempt}` }),
      '172.69.0.3'
    )

    expect(codes[3]).toBe(429)
  })
})
