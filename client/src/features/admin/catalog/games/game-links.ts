import { DEFAULT_GAME_SORT, DEFAULT_GAME_STATUS } from '@/lib/admin-games-path'
import { adminGamesParamsFrom, type AdminGamesParams } from './games-query'

/** The Catalog page's Games tab, the list of every game. */
export const ADMIN_GAMES_HREF = '/admin/catalog'

/** The Catalog page's Import runs tab, the run history. */
export const ADMIN_CATALOG_RUNS_HREF = '/admin/catalog/runs'

/** The `q=&status=&sort=&page=` of a list state, a default value left out; empty for the bare list. */
export function adminGamesListQuery(params: AdminGamesParams): string {
  const query = new URLSearchParams()
  if (params.search) query.set('q', params.search)
  if (params.status !== DEFAULT_GAME_STATUS) query.set('status', params.status)
  if (params.sort !== DEFAULT_GAME_SORT) query.set('sort', params.sort)
  if (params.page > 1) query.set('page', String(params.page))
  return query.toString()
}

/**
 * The address of a game's page in the panel. `listQuery` is the list state it was opened from, kept in
 * `?from=` so the page can lead back to the same search, filters, sort and page.
 */
export function adminGameHref(id: string, listQuery = ''): string {
  const href = `/admin/catalog/games/${encodeURIComponent(id)}`
  return listQuery ? `${href}?from=${encodeURIComponent(listQuery)}` : href
}

/**
 * The Games list a game's page leads back to, from the page's `?from=`. The value is never used as an
 * address: it is read as list parameters and rebuilt on the Games tab's own path, so anything else in it
 * (another path, an absolute URL, unknown parameters) is dropped, and a missing or empty one leads to
 * the bare list.
 */
export function adminGamesListHref(from: string | null | undefined): string {
  const values = new URLSearchParams(from ?? '')
  const query = adminGamesListQuery(
    adminGamesParamsFrom({
      q: values.get('q'),
      status: values.get('status'),
      sort: values.get('sort'),
      page: values.get('page'),
    })
  )
  return query ? `${ADMIN_GAMES_HREF}?${query}` : ADMIN_GAMES_HREF
}

/** The Squads page with one Open Squad's side panel open. */
export function adminSquadHref(id: string): string {
  return `/admin/squads?squad=${encodeURIComponent(id)}`
}

/** The Squads page kept to one game's Open Squads. */
export function adminSquadsOfGameHref(gameId: string): string {
  return `/admin/squads?gameId=${encodeURIComponent(gameId)}`
}
