/**
 * Render harness for the room flows.
 *
 * Builds a TanStack Router tree from the real route files
 * (`/rooms/` index and `/rooms/$code` lobby) re-parented onto a test root —
 * the same wiring `routeTree.gen.ts` performs at runtime, without importing
 * any generated file. The tree is mounted inside a fresh TanStack Query
 * client so cache updates are observable through public query APIs.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
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
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function buildRoomsRouteTree(): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  RoomsIndexRoute.update({
    id: '/rooms/',
    path: '/rooms/',
    getParentRoute: () => rootRoute,
  } as never)
  RoomsCodeRoute.update({
    id: '/rooms/$code',
    path: '/rooms/$code',
    getParentRoute: () => rootRoute,
  } as never)

  const rootWithChildren = rootRoute as unknown as {
    _addFileChildren: (children: unknown[]) => unknown
  }
  return rootWithChildren._addFileChildren([RoomsIndexRoute, RoomsCodeRoute]) as AnyRoute
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
