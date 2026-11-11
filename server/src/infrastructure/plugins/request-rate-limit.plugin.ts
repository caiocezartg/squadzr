import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import { RateLimitedError } from '@application/errors'
import { isHealthPath } from './edge-guard.plugin'

export interface RequestRateLimitPluginOptions {
  /** Requests one client address may make per window; 0 means no limit anywhere. */
  readonly max: number
  readonly windowMs: number
}

/**
 * The limit every route has: `max` requests per `windowMs` per client address (`request.ip`; IPv6 addresses
 * count by their /64). It runs at `onRequest`, so register it after the edge guard has set that address.
 * The health checks (Railway's probes) are not counted. A route that sets its own `config.rateLimit`
 * replaces this limit with its own and picks its hook (`preHandler`, to key on the signed-in user after
 * authentication, so an anonymous request never spends anyone's quota). The error handler shapes the 429
 * like every other error.
 */
async function requestRateLimitPlugin(
  fastify: FastifyInstance,
  { max, windowMs }: RequestRateLimitPluginOptions
): Promise<void> {
  await fastify.register(rateLimit, {
    global: max > 0,
    max,
    timeWindow: windowMs,
    hook: 'onRequest',
    ipv6Subnet: 64,
    allowList: (request) => isHealthPath(request.url),
    errorResponseBuilder: () => new RateLimitedError(),
  })
}

export default fp(requestRateLimitPlugin, {
  name: 'request-rate-limit',
  fastify: '5.x',
})
