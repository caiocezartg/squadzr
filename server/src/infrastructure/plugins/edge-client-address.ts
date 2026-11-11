import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip'

const clientAddressSchema = z.union([z.ipv4(), z.ipv6()])

/**
 * Adopts the visitor's address Cloudflare reports in `CF-Connecting-IP` as the request's client address.
 * Railway's edge replaces `x-forwarded-for` with the address that connected to it, so behind Cloudflare the
 * proxy chain alone only ever names a Cloudflare address. Callers pass only a request whose edge secret was
 * checked: anyone can write this header when they reach the origin directly.
 *
 * The address becomes the single `x-forwarded-for` entry, which is what `request.ip` and the Better Auth
 * rate limiter (fed from `request.ip`) read, and is bound to the request's log lines as `clientIp`. A missing
 * or malformed header leaves the proxy chain's address in place and logs a warning (never the header).
 */
export function adoptEdgeClientAddress(request: FastifyRequest, reply: FastifyReply): void {
  const header = request.headers[CLIENT_ADDRESS_HEADER]
  const parsed = clientAddressSchema.safeParse(header)

  if (!parsed.success) {
    request.log.warn(
      { cfConnectingIp: header === undefined ? 'missing' : 'invalid' },
      'Authenticated edge request without a usable CF-Connecting-IP'
    )
    return
  }

  request.raw.headers['x-forwarded-for'] = parsed.data
  // The reply logs "request completed" through its own reference to the request's logger.
  request.log = request.log.child({ clientIp: parsed.data })
  reply.log = request.log
}
