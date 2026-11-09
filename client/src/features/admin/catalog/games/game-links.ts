/** The Catalog page's Games tab, the list of every game. */
export const ADMIN_GAMES_HREF = '/admin/catalog'

/** The Catalog page's Import runs tab, the run history. */
export const ADMIN_CATALOG_RUNS_HREF = '/admin/catalog/runs'

/** The address of a game's page in the panel. */
export function adminGameHref(id: string): string {
  return `/admin/catalog/games/${encodeURIComponent(id)}`
}

/** The Squads page with one Open Squad's side panel open. */
export function adminSquadHref(id: string): string {
  return `/admin/squads?squad=${encodeURIComponent(id)}`
}

/** The Squads page kept to one game's Open Squads. */
export function adminSquadsOfGameHref(gameId: string): string {
  return `/admin/squads?gameId=${encodeURIComponent(gameId)}`
}
