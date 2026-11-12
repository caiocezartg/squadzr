import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import errorHandlerPlugin from './error-handler.plugin'
import edgeGuardPlugin, { EDGE_AUTH_HEADER } from './edge-guard.plugin'

const TOKEN = 'edge-secret-0123456789abcdef-0123456789'
// A proxy in front of the API, as the platform presents it to Fastify.
const PROXY_PEER = '100.64.0.1'
const CLOUDFLARE = '172.69.138.8'
const VISITOR = '203.0.113.9'

let app: Awaited<ReturnType<typeof build>> | undefined

async function build(token: string | undefined, trustProxy: number) {
  const fastify = Fastify({ logger: false, trustProxy })
  await fastify.register(errorHandlerPlugin, { config: { NODE_ENV: 'test' } })
  await fastify.register(edgeGuardPlugin, { token })
  fastify.get('/ip', async (request) => ({ ip: request.ip }))
  await fastify.ready()
  return fastify
}

afterEach(async () => {
  await app?.close()
  app = undefined
})

async function clientAddress(headers: Record<string, string>): Promise<string> {
  const response = await app!.inject({
    method: 'GET',
    url: '/ip',
    remoteAddress: PROXY_PEER,
    headers: { 'x-forwarded-for': CLOUDFLARE, ...headers },
  })
  return response.json<{ ip: string }>().ip
}

describe.each([1, 2])('with the lock on and %i trusted hops', (hops) => {
  it.each([
    ['an IPv4 address', VISITOR],
    ['an IPv6 address', '2804:1b3:aa80:d188:64ed:92bf:8a0f:2787'],
  ])('takes %s from CF-Connecting-IP', async (_label, address) => {
    app = await build(TOKEN, hops)

    expect(await clientAddress({ [EDGE_AUTH_HEADER]: TOKEN, 'cf-connecting-ip': address })).toBe(
      address
    )
  })

  it('does not let a forged x-forwarded-for entry win over CF-Connecting-IP', async () => {
    app = await build(TOKEN, hops)

    expect(
      await clientAddress({
        [EDGE_AUTH_HEADER]: TOKEN,
        'cf-connecting-ip': VISITOR,
        'x-forwarded-for': `198.51.100.66, ${CLOUDFLARE}`,
      })
    ).toBe(VISITOR)
  })

  it.each([
    ['missing', undefined],
    ['not an address', 'not-an-ip'],
    ['out of range', '999.1.1.1'],
    ['two addresses', `${VISITOR}, 198.51.100.66`],
    ['an address with a port', `${VISITOR}:443`],
    ['empty', ''],
  ])('falls back to the proxy chain when CF-Connecting-IP is %s', async (_label, value) => {
    app = await build(TOKEN, hops)

    expect(
      await clientAddress({
        [EDGE_AUTH_HEADER]: TOKEN,
        ...(value === undefined ? {} : { 'cf-connecting-ip': value }),
      })
    ).toBe(CLOUDFLARE)
  })
})

describe('with the lock off', () => {
  it('ignores CF-Connecting-IP entirely', async () => {
    app = await build(undefined, 1)

    expect(await clientAddress({ 'cf-connecting-ip': VISITOR })).toBe(CLOUDFLARE)
    expect(await clientAddress({ [EDGE_AUTH_HEADER]: TOKEN, 'cf-connecting-ip': VISITOR })).toBe(
      CLOUDFLARE
    )
  })
})

describe('a request without the right secret', () => {
  it('is refused, so a forged CF-Connecting-IP never reaches a route', async () => {
    app = await build(TOKEN, 1)

    const response = await app.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress: PROXY_PEER,
      headers: { 'cf-connecting-ip': VISITOR, [EDGE_AUTH_HEADER]: 'wrong' },
    })

    expect(response.statusCode).toBe(403)
  })
})

describe('the Worker zone', () => {
  async function loggedWorkerZones(zones: Array<string | undefined>) {
    const lines: string[] = []
    const fastify = Fastify({
      logger: { level: 'info', stream: { write: (line: string) => void lines.push(line) } },
      trustProxy: 1,
    })
    await fastify.register(edgeGuardPlugin, { token: TOKEN })
    fastify.get('/ip', async (request) => ({ ip: request.ip }))
    await fastify.ready()
    for (const zone of zones) {
      await fastify.inject({
        method: 'GET',
        url: '/ip',
        remoteAddress: PROXY_PEER,
        headers: {
          [EDGE_AUTH_HEADER]: TOKEN,
          ...(zone === undefined ? {} : { 'x-squadzr-worker-zone': zone }),
        },
      })
    }
    await fastify.close()

    return lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => line.msg === 'request completed')
      .map((line) => line.workerZone)
  }

  it('is bound to the log of a request that carries the secret, and only when it is a zone name', async () => {
    expect(await loggedWorkerZones(['Squadzr.app', 'not a zone', '<script>', undefined])).toEqual([
      'squadzr.app',
      undefined,
      undefined,
      undefined,
    ])
  })
})
