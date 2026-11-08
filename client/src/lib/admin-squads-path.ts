/**
 * The API path of one admin Squads list read. The browser's query and the server's prefetch build it
 * here, so both ask for the same page.
 */
export function adminSquadsPath(search: string, gameId: string, page: number): string {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('q', search)
  if (gameId) params.set('gameId', gameId)
  return `/api/admin/squads?${params.toString()}`
}
