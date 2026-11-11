import { afterEach, describe, expect, it } from 'vitest'
import { createLogCapture } from '@test/harness/logging'
import { connect } from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// The origin lock: with EDGE_AUTH_TOKEN set, only a request carrying the secret header the Cloudflare edge
// writes reaches the API. The health routes, which Railway probes directly, are the only exception.

const HEADER = 'x-squadzr-edge-auth'
const TOKEN = 'edge-secret-0123456789abcdef-0123456789'
const APP_ORIGIN = 'http://localhost:5173'

let server: TestServer | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

async function lockedServer(options: Parameters<typeof buildTestServer>[1] = {}) {
  server = await buildTestServer({ EDGE_AUTH_TOKEN: TOKEN }, options)
  return server
}

function get(url: string, headers: Record<string, string> = {}) {
  return server!.app.inject({ method: 'GET', url, headers })
}

describe('with EDGE_AUTH_TOKEN unset', () => {
  it('serves a request whether or not it carries the header', async () => {
    server = await buildTestServer()

    expect((await get('/api/rooms')).statusCode).toBe(200)
    expect((await get('/api/rooms', { [HEADER]: 'anything' })).statusCode).toBe(200)
  })

  it('accepts a WebSocket without the header', async () => {
    server = await buildTestServer()

    const session = await connect(server, null, {})

    expect(session.protocol.type).toBe('protocol')
    session.client.close()
  })

  it('reads an empty EDGE_AUTH_TOKEN as unset', async () => {
    server = await buildTestServer({ EDGE_AUTH_TOKEN: '' })

    expect((await get('/api/rooms')).statusCode).toBe(200)
  })
})

describe('with EDGE_AUTH_TOKEN set', () => {
  it('refuses a request without the header', async () => {
    await lockedServer()

    const response = await get('/api/rooms')

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'EDGE_AUTH_REQUIRED', message: expect.any(String) })
  })

  it.each([
    ['another value of the same length', 'x'.repeat(TOKEN.length)],
    ['a prefix of the secret', TOKEN.slice(0, -1)],
    ['the secret with a suffix', `${TOKEN}x`],
    ['an empty value', ''],
  ])('refuses %s', async (_label, value) => {
    await lockedServer()

    expect((await get('/api/rooms', { [HEADER]: value })).statusCode).toBe(403)
  })

  it('refuses the header repeated, even with the secret among its values', async () => {
    await lockedServer()

    const response = await server!.app.inject({
      method: 'GET',
      url: '/api/rooms',
      headers: { [HEADER]: [TOKEN, TOKEN] },
    })

    expect(response.statusCode).toBe(403)
  })

  it('serves a request with the secret header', async () => {
    await lockedServer()

    expect((await get('/api/rooms', { [HEADER]: TOKEN })).statusCode).toBe(200)
  })

  it('guards every method and route, an unknown one included', async () => {
    await lockedServer()

    const post = await server!.app.inject({ method: 'POST', url: '/api/rooms' })
    const unknown = await get('/api/nothing-here')
    const session = await get('/api/auth/get-session')

    expect([post.statusCode, unknown.statusCode, session.statusCode]).toEqual([403, 403, 403])
    expect((await get('/api/nothing-here', { [HEADER]: TOKEN })).statusCode).toBe(404)
    expect((await get('/api/auth/get-session', { [HEADER]: TOKEN })).statusCode).toBe(200)
  })

  it('never puts the secret in a response', async () => {
    await lockedServer()

    const refused = await get('/api/rooms', { [HEADER]: 'wrong' })

    expect(refused.body).not.toContain(TOKEN)
    expect(JSON.stringify(refused.headers)).not.toContain(TOKEN)
  })
})

describe('health routes', () => {
  it.each(['/health', '/health/ready', '/health?probe=1', '/health/ready?probe=1'])(
    'answers %s without the header',
    async (url) => {
      await lockedServer()

      expect((await get(url)).statusCode).toBe(200)
    }
  )

  it.each(['/health/', '/health/ready/', '/health/other', '/healthz', '/HEALTH', '/api/health'])(
    'does not exempt %s',
    async (url) => {
      await lockedServer()

      expect((await get(url)).statusCode).toBe(403)
    }
  )
})

describe('CORS preflight', () => {
  const preflight = {
    origin: APP_ORIGIN,
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type',
  }

  it('is refused without the header: the edge writes it on preflights too', async () => {
    await lockedServer()

    const response = await server!.app.inject({
      method: 'OPTIONS',
      url: '/api/rooms',
      headers: preflight,
    })

    expect(response.statusCode).toBe(403)
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('is answered with the header', async () => {
    await lockedServer()

    const response = await server!.app.inject({
      method: 'OPTIONS',
      url: '/api/rooms',
      headers: { ...preflight, [HEADER]: TOKEN },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(APP_ORIGIN)
  })
})

describe('WebSocket upgrade', () => {
  it('is refused without the header', async () => {
    await lockedServer()

    await expect(connect(server!, null, { origin: APP_ORIGIN })).rejects.toThrow()
  })

  it('is refused with a wrong header', async () => {
    await lockedServer()

    await expect(
      connect(server!, null, { origin: APP_ORIGIN, [HEADER]: 'wrong' })
    ).rejects.toThrow()
  })

  it('is accepted with the secret header', async () => {
    await lockedServer()

    const session = await connect(server!, null, { origin: APP_ORIGIN, [HEADER]: TOKEN })

    expect(session.protocol.type).toBe('protocol')
    session.client.close()
  })
})

describe('debug log', () => {
  function debugLines(lines: string[]) {
    return lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => line.msg === 'Edge request headers')
  }

  it('shows whether the header arrived and the Cloudflare address, never the secret', async () => {
    const capture = createLogCapture('debug')
    await lockedServer({ logger: capture.logger })

    await get('/api/rooms', { [HEADER]: TOKEN, 'cf-connecting-ip': '203.0.113.7' })
    await get('/api/rooms', { [HEADER]: 'wrong-value-wrong-value-wrong-value' })
    await get('/api/rooms')

    expect(debugLines(capture.lines)).toEqual([
      expect.objectContaining({ edgeAuthHeader: 'present', cfConnectingIp: '203.0.113.7' }),
      expect.objectContaining({ edgeAuthHeader: 'present' }),
      expect.objectContaining({ edgeAuthHeader: 'absent' }),
    ])
    expect(capture.lines.join('\n')).not.toContain(TOKEN)
    expect(capture.lines.join('\n')).not.toContain('wrong-value')
  })

  it('shows the header while the lock is off', async () => {
    const capture = createLogCapture('debug')
    server = await buildTestServer({}, { logger: capture.logger })

    await get('/api/rooms', { [HEADER]: TOKEN })

    expect(debugLines(capture.lines)).toEqual([
      expect.objectContaining({ edgeAuthHeader: 'present' }),
    ])
    expect(capture.lines.join('\n')).not.toContain(TOKEN)
  })

  it('stays out of the health probes', async () => {
    const capture = createLogCapture('debug')
    await lockedServer({ logger: capture.logger })

    await get('/health/ready')

    expect(debugLines(capture.lines)).toEqual([])
  })
})
