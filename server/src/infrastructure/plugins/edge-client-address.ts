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

const WORKER_ZONE_HEADER = 'x-squadzr-worker-zone'

// A zone name such as `squadzr.app`: what Cloudflare's `cf.worker.upstream_zone` holds.
const workerZoneSchema = z
  .string()
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i)

/**
 * Binds the zone of the Worker that made the request, when there is one, to the request's log lines as
 * `workerZone`. The Cloudflare edge writes the header from `cf.worker.upstream_zone` on everything it
 * forwards and removes it from requests that no Worker made, so a client cannot choose it. Callers pass
 * only a request whose edge secret was checked. It says which requests are the app's own server renders
 * (`squadzr.app`) and which came from some other zone's Worker; it grants nothing.
 */
export function bindWorkerZone(request: FastifyRequest, reply: FastifyReply): void {
  const parsed = workerZoneSchema.safeParse(request.headers[WORKER_ZONE_HEADER])
  if (!parsed.success) return

  request.log = request.log.child({ workerZone: parsed.data.toLowerCase() })
  reply.log = request.log
}
