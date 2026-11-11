import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import errorHandlerPlugin from './error-handler.plugin'
import edgeGuardPlugin, { EDGE_AUTH_HEADER } from './edge-guard.plugin'

const TOKEN = 'edge-secret-0123456789abcdef-0123456789'
const RAILWAY_EDGE = '100.64.0.1'
// What the Railway edge writes into x-forwarded-for: the address that connected to it.
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
    remoteAddress: RAILWAY_EDGE,
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
      remoteAddress: RAILWAY_EDGE,
      headers: { 'cf-connecting-ip': VISITOR, [EDGE_AUTH_HEADER]: 'wrong' },
    })

    expect(response.statusCode).toBe(403)
  })
})
