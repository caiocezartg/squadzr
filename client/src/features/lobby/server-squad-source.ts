import 'server-only'
import { gameResponseSchema, roomResponseSchema } from '@squadzr/schemas'
import { serverApi } from '@/lib/server/api'
import type { RequestViewer } from '@/lib/server/viewer'
import type { DetailsSource } from './squad-details'

// A slow Fastify holds the page for at most this long; the browser then reads the Squad itself.
const LOBBY_TIMEOUT_MS = 2_000

/**
 * The Lobby's reads for one viewer. The Squad read carries the viewer's cookie, so Fastify answers with
 * the member view to a member. Neither read is cached: both are that viewer's, or read for a Squad that
 * may change at any moment.
 */
export function viewerSquadSource({ cookie, forwardedFor }: RequestViewer): DetailsSource {
  return {
    readSquad: (squadCode) =>
      serverApi.get(
        `/api/rooms/${encodeURIComponent(squadCode)}`,
        roomResponseSchema,
        { credentials: 'viewer', caching: 'uncached', cookie, forwardedFor },
        { timeoutMs: LOBBY_TIMEOUT_MS }
      ),
    readGame: readPublicGame,
  }
}

/**
 * The reads behind the invite preview. They are anonymous and never cached, so the preview can only
 * show what a visitor sees: the public projection, and a game.
 */
export const publicSquadSource: DetailsSource = {
  readSquad: (squadCode) =>
    serverApi.get(
      `/api/rooms/${encodeURIComponent(squadCode)}`,
      roomResponseSchema,
      { credentials: 'anonymous', caching: 'uncached' },
      { timeoutMs: LOBBY_TIMEOUT_MS }
    ),
  readGame: readPublicGame,
}

function readPublicGame(gameId: string) {
  return serverApi
    .get(
      `/api/games/${encodeURIComponent(gameId)}`,
      gameResponseSchema,
      { credentials: 'anonymous', caching: 'uncached' },
      { timeoutMs: LOBBY_TIMEOUT_MS }
    )
    .then(({ game }) => game)
}
