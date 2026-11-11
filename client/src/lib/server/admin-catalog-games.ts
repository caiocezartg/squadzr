import 'server-only'
import {
  adminGameDetailResponseSchema,
  adminGamesResponseSchema,
  adminGamesSummarySchema,
  type AdminGameDetailResponse,
  type AdminGamesResponse,
  type AdminGamesSummaryDto,
} from '@squadzr/schemas'
import {
  ADMIN_GAMES_SUMMARY_PATH,
  adminGamePath,
  adminGamesPath,
  type AdminGamesParams,
} from '../admin-games-path'
import { serverApi } from './api'
import type { RequestViewer } from './viewer'

// A slow Fastify holds the page for at most this long; the browser then reads the data itself.
const ADMIN_GAMES_TIMEOUT_MS = 2_000

function viewerRead(viewer: RequestViewer) {
  return { credentials: 'viewer', caching: 'uncached', cookie: viewer.cookie } as const
}

/**
 * One page of the catalog's games as the admin who sent the request may read it. The response is that
 * admin's data, so it is read per request and never cached. Any failure throws.
 */
export function loadAdminGames(
  viewer: RequestViewer,
  params: AdminGamesParams
): Promise<AdminGamesResponse> {
  return serverApi.get(adminGamesPath(params), adminGamesResponseSchema, viewerRead(viewer), {
    timeoutMs: ADMIN_GAMES_TIMEOUT_MS,
  })
}

/** The Games tab's summary, read the same way. */
export function loadAdminGamesSummary(viewer: RequestViewer): Promise<AdminGamesSummaryDto> {
  return serverApi.get(ADMIN_GAMES_SUMMARY_PATH, adminGamesSummarySchema, viewerRead(viewer), {
    timeoutMs: ADMIN_GAMES_TIMEOUT_MS,
  })
}

/** One game's page, read the same way. */
export function loadAdminGame(viewer: RequestViewer, id: string): Promise<AdminGameDetailResponse> {
  return serverApi.get(adminGamePath(id), adminGameDetailResponseSchema, viewerRead(viewer), {
    timeoutMs: ADMIN_GAMES_TIMEOUT_MS,
  })
}
