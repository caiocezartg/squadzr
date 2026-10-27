import 'server-only'
import { myRoomsResponseSchema, type MyRoomsResponse } from '@squadzr/schemas'
import { isUnauthorized } from '@/lib/api-contract'
import { serverApi } from './api'
import type { RequestViewer } from './viewer'

// A slow Fastify holds the page for at most this long; the browser then reads the list itself.
const MY_SQUADS_TIMEOUT_MS = 2_000

/**
 * The Squads the viewer hosts or belongs to, as Fastify lists them: hosted first, joined next,
 * Ready Squads inside their retention window included. The response is that viewer's data, so it
 * is read per request and never cached. A 401 means the viewer is signed out and reads as `null`;
 * any other failure throws.
 */
export async function loadMySquads(viewer: RequestViewer): Promise<MyRoomsResponse | null> {
  try {
    return await serverApi.get(
      '/api/rooms/my',
      myRoomsResponseSchema,
      {
        credentials: 'viewer',
        caching: 'uncached',
        cookie: viewer.cookie,
        forwardedFor: viewer.forwardedFor,
      },
      { timeoutMs: MY_SQUADS_TIMEOUT_MS }
    )
  } catch (error) {
    if (isUnauthorized(error)) return null
    throw error
  }
}
