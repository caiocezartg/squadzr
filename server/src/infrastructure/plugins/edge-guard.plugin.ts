import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { EdgeAuthRequiredError } from '@application/errors'

/** The header the Cloudflare edge overwrites on every request it forwards to the API. */
export const EDGE_AUTH_HEADER = 'x-squadzr-edge-auth'

/** The two routes the hosting platform probes directly, outside the edge. Exactly these, nothing under them. */
const HEALTH_PATHS: ReadonlySet<string> = new Set(['/health', '/health/ready'])

export interface EdgeGuardPluginOptions {
  /** The secret the edge sends. Unset: the lock is off and every request goes on. */
  readonly token: string | undefined
}

/** Whether the request targets a health route. The query string is not part of the route. */
export function isHealthPath(url: string): boolean {
  const query = url.indexOf('?')
  return HEALTH_PATHS.has(query === -1 ? url : url.slice(0, query))
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

/**
 * Whether the received header carries the secret. Both sides are hashed first, so the comparison takes the
 * same time whatever the lengths and however many leading characters match.
 */
export function hasEdgeToken(received: string | string[] | undefined, expected: string): boolean {
  if (typeof received !== 'string') return false
  return timingSafeEqual(digest(received), digest(expected))
}

/**
 * The origin lock: only a request the Cloudflare edge forwarded, which carries the secret it writes, reaches
 * the routes. Runs before everything else, so a refused request touches no cookie, no CORS reflection and no
 * WebSocket handshake. A debug line shows whether the header arrived (never its value), which is how the
 * hosted API proves the edge sends it while the lock is still off.
 */
async function edgeGuardPlugin(
  fastify: FastifyInstance,
  { token }: EdgeGuardPluginOptions
): Promise<void> {
  fastify.addHook('onRequest', async (request) => {
    if (isHealthPath(request.url)) return

    const received = request.headers[EDGE_AUTH_HEADER]
    request.log.debug(
      {
        edgeAuthHeader: received === undefined ? 'absent' : 'present',
        cfConnectingIp: request.headers['cf-connecting-ip'],
      },
      'Edge request headers'
    )

    if (token !== undefined && !hasEdgeToken(received, token)) {
      throw new EdgeAuthRequiredError()
    }
  })
}

export default fp(edgeGuardPlugin, {
  name: 'edge-guard',
  fastify: '5.x',
})
