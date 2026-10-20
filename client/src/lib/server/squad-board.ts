import 'server-only'
import { roomsResponseSchema, type RoomsResponse } from '@squadzr/schemas'
import { serverApi } from './api'
import type { RequestViewer } from './viewer'

// A slow Fastify holds the page for at most this long; the browser then reads the board itself.
const SQUAD_BOARD_TIMEOUT_MS = 2_000

/**
 * The complete Squad Board list as the viewer sees it: every open squad, with `isMember` on the
 * squads the viewer belongs to. The response is that viewer's data, so it is read per request and
 * never cached. A failed read throws.
 */
export function loadSquadBoard(viewer: RequestViewer): Promise<RoomsResponse> {
  return serverApi.get(
    '/api/rooms',
    roomsResponseSchema,
    {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: viewer.cookie,
      forwardedFor: viewer.forwardedFor,
    },
    { timeoutMs: SQUAD_BOARD_TIMEOUT_MS }
  )
}
