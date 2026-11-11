'use client'

import { useSearchParams } from 'next/navigation'
import { adminGamesListHref, adminGamesListQuery } from './game-links'
import { adminGamesParamsFrom } from './games-query'

/**
 * The Games list's current state as its query string, for the links that open a game from the list. It
 * is read from the URL the way the list reads it, so it names the page the list is showing.
 */
export function useGamesListQuery(): string {
  const params = useSearchParams()
  return adminGamesListQuery(
    adminGamesParamsFrom({
      q: params.get('q'),
      status: params.get('status'),
      sort: params.get('sort'),
      page: params.get('page'),
    })
  )
}

/** Where a game's page leads back to: the Games list as it was when the game was opened. */
export function useGamesListHref(): string {
  return adminGamesListHref(useSearchParams().get('from'))
}
