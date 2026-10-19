/**
 * Render harness for the room flows.
 *
 * Composes a TanStack Router tree using only the library's public code-based
 * API (`createRootRoute` + `createRoute` + `addChildren`). The tree mounts the
 * REAL page components and search validation, taken from the public `options`
 * of the imported route files (`/rooms/` index, `/rooms/$code` lobby and
 * `/rooms/my`), so the tests exercise the actual route implementations without
 * any generated internals (`_addFileChildren`, `_addFileTypes`, `update`
 * re-parenting) or details of `routeTree.gen.ts`.
 *
 * The tree renders with next-intl and the real English messages. Its location
 * is the harness navigation, which `next/navigation` and `next/link` share (see
 * ./navigation). The tree is mounted inside a fresh TanStack Query client so
 * cache updates are observable through public query APIs. The realtime update
 * notice is mounted beside it, as the root layout mounts it beside the app.
 */

import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { AnyRoute, Router } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { RealtimeUpdateNotice } from '@/components/layout/realtime-update-notice'
import { Route as RoomsIndexRoute } from '@/routes/rooms/index'
import { Route as RoomsCodeRoute } from '@/routes/rooms/$code'
import { Route as RoomsMyRoute } from '@/routes/rooms/my'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import type { HarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'
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

  const roomsMyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/my',
    validateSearch: RoomsMyRoute.options.validateSearch,
    component: RoomsMyRoute.options.component,
  })

  return rootRoute.addChildren([roomsIndexRoute, roomsCodeRoute, roomsMyRoute]) as AnyRoute
}

export interface RoomsFlow {
  user: UserEvent
  queryClient: QueryClient
  router: Router<AnyRoute>
  /** The in-memory location the router and the Next hooks share, with the calls recorded on it. */
  navigation: HarnessNavigation
  /** Unmounts the tree; remount by rendering again with the same queryClient. */
  unmount: () => void
}

export interface RenderRoomsFlowOptions {
  /** `undefined` → default signed-in user; `null` → signed-out guest. */
  user?: FakeSessionUser | null
  /** Bring your own client to seed or inspect the query cache. */
  queryClient?: QueryClient
  /** Mirrors the app entry, which mounts the tree inside React.StrictMode. */
  strictMode?: boolean
}

export function renderRoomsFlow(url: string, options: RenderRoomsFlowOptions = {}): RoomsFlow {
  const queryClient = options.queryClient ?? createTestQueryClient()
  if (options.user === null) {
    signOutFakeUser()
  } else {
    signInAsFakeUser(options.user ?? {})
  }

  const navigation = createHarnessNavigation(url)
  const router = createRouter({
    routeTree: buildRoomsRouteTree(),
    history: navigation.history,
  })

  // The session provider starts from this test's viewer, as the server's read would for this visit.
  const tree = (
    <EnglishIntlProvider session={fakeSession()}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <RealtimeUpdateNotice />
      </QueryClientProvider>
    </EnglishIntlProvider>
  )

  const view = render(options.strictMode ? <StrictMode>{tree}</StrictMode> : tree)

  return {
    user: userEvent.setup({ delay: null }),
    queryClient,
    router,
    navigation,
    unmount: () => view.unmount(),
  }
}
