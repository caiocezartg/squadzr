import type { FastifyInstance, FastifyRequest } from 'fastify'
import { RateLimitedError } from '@application/errors'

export interface UserRateLimitOptions {
  /** Requests one signed-in user may make per window. */
  readonly max: number
  readonly timeWindowMs: number
}

/**
 * A `preHandler` that limits a route per signed-in user, next to the per-address limit every route has at
 * `onRequest`. Run it after `requireAuth`, so an unauthenticated request answers 401 without spending a
 * user's quota (the per-address limit has already counted it). It is built from `createRateLimit`, which
 * counts in a store of its own and does not set the "ran" flag the route-level limiters share, so it never
 * skips, or is skipped by, the per-address limit.
 */
// Declares only what the hook touches (see `auth.hook.ts`): a full `FastifyRequest` parameter would pin the
// route's generics to their defaults and a controller typed by its schema could no longer be the handler.
type LimitedRequest = Pick<FastifyRequest, 'session'>
interface LimitedReply {
  header(name: string, value: number): unknown
}

export function createUserRateLimit(
  fastify: FastifyInstance,
  { max, timeWindowMs }: UserRateLimitOptions
) {
  const check = fastify.createRateLimit({
    max,
    timeWindow: timeWindowMs,
    // `requireAuth` has run: a request that reaches the limit has a session.
    keyGenerator: (request) => request.session?.user?.id ?? request.ip,
  })

  return async function limitPerUser(request: LimitedRequest, reply: LimitedReply): Promise<void> {
    // Fastify hands this hook the whole request; the narrow type above only keeps the route's types intact.
    const result = await check(request as FastifyRequest)
    if (result.isAllowed || !result.isExceeded) return

    reply.header('retry-after', result.ttlInSeconds)
    throw new RateLimitedError()
  }
}
