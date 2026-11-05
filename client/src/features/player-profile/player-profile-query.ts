import { useCallback } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { playerProfileResponseSchema, type PlayerProfileDto } from '@squadzr/schemas'
import { ApiClientError, api } from '@/lib/api'

/** A profile read this recently opens from the cache without asking again (and without a skeleton). */
const PROFILE_STALE_MS = 60_000

/** The cache key of one person's profile; a prefix of it addresses every profile. */
export const playerProfileQueryKey = (playerId: string) => ['player-profile', playerId] as const

/** Starts loading the picture the profile's header will show, so the dialog opens with it in place. */
function preloadCover(profile: PlayerProfileDto): void {
  const cover = profile.topGames[0]?.game.coverUrl
  if (cover && typeof Image !== 'undefined') new Image().src = cover
}

async function readPlayerProfile(playerId: string, signal: AbortSignal): Promise<PlayerProfileDto> {
  const { profile } = await api.get(
    `/api/users/${encodeURIComponent(playerId)}/profile`,
    playerProfileResponseSchema,
    signal
  )
  preloadCover(profile)
  return profile
}

/** One retry keeps a flaky network from holding the skeleton for seconds; a refusal (404) is never retried. */
function retryOnce(failureCount: number, error: Error): boolean {
  if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

function playerProfileQuery(playerId: string) {
  return {
    queryKey: playerProfileQueryKey(playerId),
    queryFn: ({ signal }: { signal: AbortSignal }) => readPlayerProfile(playerId, signal),
    staleTime: PROFILE_STALE_MS,
  }
}

/**
 * One person's public profile. A profile already in the cache is returned at once and read again in the
 * background once it is a minute old, so reopening a profile never shows a loading state.
 */
export function usePlayerProfile(playerId: string) {
  return useQuery({ ...playerProfileQuery(playerId), retry: retryOnce })
}

/** Reads a profile ahead, as a hover or focus on someone's tile hints it will open. Never throws. */
export function usePrefetchPlayerProfile(): (playerId: string) => void {
  const queryClient = useQueryClient()

  return useCallback(
    (playerId: string) => void prefetchPlayerProfile(queryClient, playerId),
    [queryClient]
  )
}

function prefetchPlayerProfile(queryClient: QueryClient, playerId: string): Promise<void> {
  return queryClient.prefetchQuery(playerProfileQuery(playerId))
}
