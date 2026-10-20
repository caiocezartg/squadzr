import type { QueryClient } from '@tanstack/react-query'

/**
 * The My Squads list's query key. It stays private to the capability: callers refresh their own
 * data through the hook that owns the query, never through the key.
 */
export const mySquadsQueryKey = ['my-squads'] as const

/**
 * Drops the list when its read failed and left no data, so a later visit reads again. A failed
 * query stays in the cache and a suspending reader rethrows it without reading, so without this a
 * revisit with a healthy API would show the old error.
 */
export function discardFailedMySquadsRead(queryClient: QueryClient): void {
  queryClient.removeQueries({
    queryKey: mySquadsQueryKey,
    exact: true,
    predicate: (query) => query.state.status === 'error' && query.state.data === undefined,
  })
}
