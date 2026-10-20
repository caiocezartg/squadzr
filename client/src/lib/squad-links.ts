/**
 * The address of a Squad's Lobby. Every link to a Lobby is built here, so the path lives in one place.
 */
export function lobbyHref(squadCode: string): string {
  return `/squads/${encodeURIComponent(squadCode)}`
}
