'use client'

import { useEffect, useRef } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  catalogImportRunsResponseSchema,
  requestCatalogImportRunResponseSchema,
} from '@squadzr/schemas'
import { api } from '@/lib/api'
import { catalogRunsQueryKey } from './catalog-query'

/** How often the history is read again while a run is queued or running. */
export const ACTIVE_RUN_POLL_MS = 3_000

/** The longest delay `setTimeout` takes; a later instant is simply not waited for. */
const MAX_TIMER_MS = 2_147_483_647

function readCatalogImportRuns(page: number) {
  return api.get(`/api/admin/catalog-import/runs?page=${page}`, catalogImportRunsResponseSchema)
}

/**
 * One page of the run history. A page the cache holds (the server's prefetch, an earlier visit)
 * renders at once; moving to a page the cache lacks keeps the previous page on screen until the new
 * one lands, so the table never empties in between. While a run is queued or running the page is read
 * again every few seconds, and polling stops at the run's final status.
 */
export function useCatalogImportRuns(page: number) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: catalogRunsQueryKey(page),
    queryFn: () => readCatalogImportRuns(page),
    placeholderData: keepPreviousData,
    refetchInterval: (current) => (current.state.data?.activeRun ? ACTIVE_RUN_POLL_MS : false),
  })

  // A run that just finished changed what the other panels show: the Overview's last run and the Games.
  const wasActive = useRef(false)
  const isActive = Boolean(query.data?.activeRun)
  useEffect(() => {
    if (wasActive.current && !isActive) {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog-games'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] })
    }
    wasActive.current = isActive
  }, [isActive, queryClient])

  const availableAt =
    query.data?.manualRun.available === false ? query.data.manualRun.availableAt : null
  const { refetch } = query
  // Left open across the end of the 24 h window, the panel would keep showing a past instant: read the
  // history once more at that instant, then the fresh answer says it is available. No polling in between.
  useEffect(() => {
    if (!availableAt) return
    const delay = new Date(availableAt).getTime() - Date.now()
    if (delay > MAX_TIMER_MS) return
    const timer = setTimeout(() => void refetch(), Math.max(delay, 0))
    return () => clearTimeout(timer)
  }, [availableAt, refetch])

  return query
}

/**
 * Requests a manual Catalog Import. The request only queues the run, so on success (and on a refusal
 * that says the state moved: the limit or a taken slot) every page of the history is read again and the
 * panel follows the run from there.
 */
export function useRequestCatalogImportRun() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'catalog-runs'] })

  return useMutation({
    mutationFn: () =>
      api.post('/api/admin/catalog-import/runs', undefined, requestCatalogImportRunResponseSchema),
    onSuccess: refresh,
    onError: refresh,
  })
}
