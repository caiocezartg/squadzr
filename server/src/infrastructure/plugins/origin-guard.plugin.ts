import type { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { ForbiddenOriginError } from '@application/errors'

export interface OriginGuardPluginOptions {
  /** The origins a browser may change state from: the app's and the API's own. */
  readonly allowedOrigins: readonly string[]
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const WEBSOCKET_PATH = '/ws'

/**
 * Whether a request may go on. A browser attaches the session cookie to a request another site starts, and a
 * text/plain POST needs no CORS preflight, so CORS alone does not stop it: the Origin header does. Reads
 * change nothing and CORS keeps their answer from the other site. The WebSocket handshake is a GET, but it
 * hands the socket the visitor's session, so it is checked too. A request without an Origin comes from no
 * browser page and carries no visitor's cookie on its behalf, so it goes on.
 */
export function isAllowedRequest(
  request: Pick<FastifyRequest, 'method' | 'url' | 'headers'>,
  allowedOrigins: ReadonlySet<string>
): boolean {
  const opensWebSocket =
    request.url === WEBSOCKET_PATH || request.url.startsWith(`${WEBSOCKET_PATH}?`)
  if (SAFE_METHODS.has(request.method) && !opensWebSocket) return true

  const origin = request.headers.origin
  if (origin === undefined) return true
  return allowedOrigins.has(origin)
}

/** The origin of a configured URL, as a browser writes it in the Origin header (no path, no trailing slash). */
function toOrigin(url: string): string {
  return new URL(url).origin
}

async function originGuardPlugin(
  fastify: FastifyInstance,
  options: OriginGuardPluginOptions
): Promise<void> {
  const allowedOrigins = new Set(options.allowedOrigins.map(toOrigin))

  fastify.addHook('onRequest', async (request) => {
    if (!isAllowedRequest(request, allowedOrigins)) {
      throw new ForbiddenOriginError()
    }
  })
}

export default fp(originGuardPlugin, {
  name: 'origin-guard',
  fastify: '5.x',
})
