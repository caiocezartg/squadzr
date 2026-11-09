import type { AdminSquadSort, Platform, RoomLanguage } from '@squadzr/schemas'

/** What one read of the admin Squads list asks for; an empty string is "no filter". */
export interface AdminSquadsParams {
  /** Matches the Squad's name or code, or the host's name; empty is no search. */
  readonly search: string
  /** The Game to keep; empty is every Game. */
  readonly gameId: string
  /** The platform to keep; empty is every platform. */
  readonly platform: Platform | ''
  /** The Squad language to keep; empty is every language. */
  readonly language: RoomLanguage | ''
  readonly sort: AdminSquadSort
  readonly page: number
}

/**
 * The API path of one admin Squads list read. The browser's query and the server's prefetch build it
 * here, so both ask for the same page. A default (newest, no filter) leaves its parameter out.
 */
export function adminSquadsPath(params: AdminSquadsParams): string {
  const query = new URLSearchParams({ page: String(params.page) })
  if (params.search) query.set('q', params.search)
  if (params.gameId) query.set('gameId', params.gameId)
  if (params.platform) query.set('platform', params.platform)
  if (params.language) query.set('language', params.language)
  if (params.sort !== 'newest') query.set('sort', params.sort)
  return `/api/admin/squads?${query.toString()}`
}
