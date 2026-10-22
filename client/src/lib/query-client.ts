import { cache } from 'react'
import {
  defaultShouldDehydrateQuery,
  dehydrate,
  isServer,
  QueryClient,
  type DehydratedState,
  type Query,
} from '@tanstack/react-query'
import { ApiClientError } from './api-contract'

type DehydratedQuery = DehydratedState['queries'][number]

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        gcTime: 1000 * 60 * 5, // 5 minutes
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
            return false
          }
          return failureCount < 3
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// React's cache scopes a value to one server request: every render of that request gets the same
// client, and the client is dropped when the request ends. No client outlives its request.
const getRequestQueryClient = cache(createQueryClient)

let browserQueryClient: QueryClient | undefined

/**
 * The query client of the current environment. On the server it is the client of the current request.
 * In the browser it is one client for the life of the page, so a rerender never resets the cache.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return getRequestQueryClient()

  browserQueryClient ??= createQueryClient()
  return browserQueryClient
}

/**
 * Runs a route's prefetches in the request's client and returns the state the page hands to the
 * browser through a `HydrationBoundary`. The callback decides what the page waits for: a promise it
 * returns is awaited, while a read it starts without returning one keeps running. A read still running
 * when the state is taken reaches the browser as a pending query, and the browser's cache settles it
 * when the read lands. A read that failed before then is left out, so the browser fetches it again.
 */
export async function prefetchRoute(
  prefetch: (queryClient: QueryClient) => unknown
): Promise<DehydratedState> {
  const queryClient = getQueryClient()
  await prefetch(queryClient)
  const state = dehydrate(queryClient, { shouldDehydrateQuery: shouldDehydrateRouteQuery })
  return { ...state, queries: state.queries.map(withoutFreshness) }
}

/** A finished query goes with its data. A query still loading goes as a promise the browser waits on. */
function shouldDehydrateRouteQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) || query.state.status === 'pending'
}

/**
 * A query still loading leaves out `dehydratedAt`, the time the server took its state. Without it the
 * browser keeps a query it already holds: when the server's read has settled by the time the page is
 * hydrated, the browser would otherwise write the server's pending state over the cached data, so the
 * cached list would suspend. The browser's own read refreshes the cached list instead.
 *
 * `hydrate` documents a payload without `dehydratedAt` only as one from an older version, so this
 * depends on the pinned TanStack Query version (`client/package.json`). The specs in
 * `query-client.server.spec.ts` fail when an upgrade changes how such a payload hydrates.
 */
function withoutFreshness(query: DehydratedQuery): DehydratedQuery {
  if (query.promise === undefined) return query

  const { dehydratedAt: _servedAt, ...rest } = query
  return rest
}
