import { cache } from 'react'
import { dehydrate, isServer, QueryClient, type DehydratedState } from '@tanstack/react-query'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        gcTime: 1000 * 60 * 5, // 5 minutes
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error instanceof Error && 'status' in error) {
            const status = (error as { status: number }).status
            if (status >= 400 && status < 500) {
              return false
            }
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
 * browser through a `HydrationBoundary`. A query that failed is left out, so the browser fetches it again.
 */
export async function prefetchRoute(
  prefetch: (queryClient: QueryClient) => Promise<unknown>
): Promise<DehydratedState> {
  const queryClient = getQueryClient()
  await prefetch(queryClient)
  return dehydrate(queryClient)
}
