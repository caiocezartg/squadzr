import 'server-only'
import { roomResponseSchema } from '@squadzr/schemas'
import { serverApi } from '@/lib/server/api'
import type { RequestViewer } from '@/lib/server/viewer'
import type { SquadSource } from './squad-details'

// A slow Fastify holds the page for at most this long; the browser then reads the Squad itself.
const LOBBY_TIMEOUT_MS = 2_000

/**
 * The Lobby's read for one viewer. The Squad read carries the viewer's cookie, so Fastify answers with
 * the member view to a member. It is not cached: it is that viewer's, or read for a Squad that may
 * change at any moment. The response carries the Squad's game summary.
 */
export function viewerSquadSource({ cookie, forwardedFor }: RequestViewer): SquadSource {
  return {
    readSquad: (squadCode) =>
      serverApi.get(
        `/api/rooms/${encodeURIComponent(squadCode)}`,
        roomResponseSchema,
        { credentials: 'viewer', caching: 'uncached', cookie, forwardedFor },
        { timeoutMs: LOBBY_TIMEOUT_MS }
      ),
  }
}

/**
 * The read behind the invite preview. It is anonymous and never cached, so the preview can only show
 * what a visitor sees: the public projection, with its game summary.
 */
export const publicSquadSource: SquadSource = {
  readSquad: (squadCode) =>
    serverApi.get(
      `/api/rooms/${encodeURIComponent(squadCode)}`,
      roomResponseSchema,
      { credentials: 'anonymous', caching: 'uncached' },
      { timeoutMs: LOBBY_TIMEOUT_MS }
    ),
}
