/**
 * Render harness for the room flows.
 *
 * Composes a TanStack Router tree using only the library's public code-based
 * API (`createRootRoute` + `createRoute` + `addChildren`). The tree mounts the
 * REAL page components and search validation, taken from the public `options`
 * of the imported route files (`/rooms/` index and `/rooms/$code` lobby), so
 * the tests exercise the actual route implementations without any generated
 * internals (`_addFileChildren`, `_addFileTypes`, `update` re-parenting) or
 * details of `routeTree.gen.ts`.
 *
 * The tree is mounted inside a fresh TanStack Query client so cache updates
 * are observable through public query APIs.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { AnyRoute, Router } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { Route as RoomsIndexRoute } from '@/routes/rooms/index'
import { Route as RoomsCodeRoute } from '@/routes/rooms/$code'
import { signInAsFakeUser, signOutFakeUser } from './stubs'
import type { FakeSessionUser } from './stubs'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // The app caches query data for a minute (src/lib/query-client.ts); the
      // tests keep the same freshness so a freshly written cache entry looks
      // as fresh here as it would in production. Retries stay off so failures
      // surface deterministically.
      queries: { retry: false, staleTime: 60_000 },
      mutations: { retry: false },
    },
  })
}

function buildRoomsRouteTree(): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })

  const roomsIndexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/',
    validateSearch: RoomsIndexRoute.options.validateSearch,
    component: RoomsIndexRoute.options.component,
  })

  const roomsCodeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/$code',
    component: RoomsCodeRoute.options.component,
  })

  return rootRoute.addChildren([roomsIndexRoute, roomsCodeRoute]) as AnyRoute
}

export interface RoomsFlow {
  user: UserEvent
  queryClient: QueryClient
  router: Router<AnyRoute>
}

export interface RenderRoomsFlowOptions {
  /** `undefined` → default signed-in user; `null` → signed-out guest. */
  user?: FakeSessionUser | null
  /** Bring your own client to seed or inspect the query cache. */
  queryClient?: QueryClient
}

export function renderRoomsFlow(url: string, options: RenderRoomsFlowOptions = {}): RoomsFlow {
  const queryClient = options.queryClient ?? createTestQueryClient()
  if (options.user === null) {
    signOutFakeUser()
  } else {
    signInAsFakeUser(options.user ?? {})
  }

  const router = createRouter({
    routeTree: buildRoomsRouteTree(),
    history: createMemoryHistory({ initialEntries: [url] }),
  })

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  return { user: userEvent.setup({ delay: null }), queryClient, router }
}
