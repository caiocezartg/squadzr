import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip'

const clientAddressSchema = z.union([z.ipv4(), z.ipv6()])

/**
 * Adopts the visitor's address Cloudflare reports in `CF-Connecting-IP` as the request's client address.
 * The proxy chain alone (`x-forwarded-for` through `TRUST_PROXY_HOPS`) is only a fallback: a Worker's
 * subrequest names the Worker's own address there. Callers pass only a request whose edge secret was
 * checked: anyone who reaches the origin some other way can write this header.
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
 * forwards and removes it from requests that no Worker made, so a client cannot choose it. That zone is
 * empty for a Worker of the same zone, so the app's own server renders carry no `workerZone`; a value
 * would name another zone's Worker, which the edge blocks before the request gets here. Callers pass only
 * a request whose edge secret was checked. It grants nothing.
 */
export function bindWorkerZone(request: FastifyRequest, reply: FastifyReply): void {
  const parsed = workerZoneSchema.safeParse(request.headers[WORKER_ZONE_HEADER])
  if (!parsed.success) return

  request.log = request.log.child({ workerZone: parsed.data.toLowerCase() })
  reply.log = request.log
}
