import type { AdminGameSort, AdminGameStatus } from '@squadzr/schemas'

/** What one read of the admin Games list asks for; an empty search is "no search". */
export interface AdminGamesParams {
  /** Matches the game's name or an alias; empty is no search. */
  readonly search: string
  readonly status: AdminGameStatus
  readonly sort: AdminGameSort
  readonly page: number
}

/** The list's defaults, which the URL and the API path leave out. */
export const DEFAULT_GAME_STATUS: AdminGameStatus = 'all'
export const DEFAULT_GAME_SORT: AdminGameSort = 'popularity'

/**
 * The API path of one admin Games list read. The browser's query and the server's prefetch build it
 * here, so both ask for the same page. A default (every status, by popularity) leaves its parameter out.
 */
export function adminGamesPath(params: AdminGamesParams): string {
  const query = new URLSearchParams({ page: String(params.page) })
  if (params.search) query.set('q', params.search)
  if (params.status !== DEFAULT_GAME_STATUS) query.set('status', params.status)
  if (params.sort !== DEFAULT_GAME_SORT) query.set('sort', params.sort)
  return `/api/admin/catalog/games?${query.toString()}`
}

/** The API path of the Games tab's summary. */
export const ADMIN_GAMES_SUMMARY_PATH = '/api/admin/catalog/games/summary'

/** The API path of one game's page. */
export function adminGamePath(id: string): string {
  return `/api/admin/catalog/games/${encodeURIComponent(id)}`
}
