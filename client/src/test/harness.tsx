/**
 * Render harness for the squad flows.
 *
 * Composes a TanStack Router tree using only the library's public code-based
 * API (`createRootRoute` + `createRoute` + `addChildren`). The tree stands in for
 * the app's two routers: the Squad Board and the Lobby are App Router pages in the
 * app, and they mount here at `/squads` and `/squads/$code`, next to the old app's
 * `/rooms/my` (My Squads). Each route mounts the REAL page component, and
 * the My Squads route takes its search validation from the imported route file,
 * so the tests exercise the actual implementations without any generated
 * internals (`_addFileChildren`, `_addFileTypes`, `update` re-parenting) or
 * details of `routeTree.gen.ts`.
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
  useParams,
} from '@tanstack/react-router'
import type { AnyRoute, Router } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { RealtimeUpdateNotice } from '@/components/layout/realtime-update-notice'
import { LobbyPage } from '@/features/lobby'
import { SquadBoardPage } from '@/features/squad-board/page'
import { squadsSearchSchema } from '@/features/squad-list'
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

function buildSquadsRouteTree(): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })

  const squadBoardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/squads',
    // The App Router parses the same search on the server, so the board sees a validated search here too.
    validateSearch: (raw) => squadsSearchSchema.parse(raw),
    component: SquadBoardPage,
  })

  const squadLobbyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/squads/$code',
    component: SquadLobbyScene,
  })

  const roomsMyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/my',
    validateSearch: RoomsMyRoute.options.validateSearch,
    component: RoomsMyRoute.options.component,
  })

  return rootRoute.addChildren([squadBoardRoute, squadLobbyRoute, roomsMyRoute]) as AnyRoute
}

/** The Lobby at the Squad code of the URL, as the App Router page renders it. */
function SquadLobbyScene() {
  const { code = '' } = useParams({ strict: false }) as { code?: string }

  return <LobbyPage squadCode={code} />
}

export interface SquadsFlow {
  user: UserEvent
  queryClient: QueryClient
  router: Router<AnyRoute>
  /** The in-memory location the router and the Next hooks share, with the calls recorded on it. */
  navigation: HarnessNavigation
  /** Unmounts the tree; remount by rendering again with the same queryClient. */
  unmount: () => void
}

export interface RenderSquadsFlowOptions {
  /** `undefined` → default signed-in user; `null` → signed-out guest. */
  user?: FakeSessionUser | null
  /** Bring your own client to seed or inspect the query cache. */
  queryClient?: QueryClient
  /** Mirrors the app entry, which mounts the tree inside React.StrictMode. */
  strictMode?: boolean
}

export function renderSquadsFlow(url: string, options: RenderSquadsFlowOptions = {}): SquadsFlow {
  const queryClient = options.queryClient ?? createTestQueryClient()
  if (options.user === null) {
    signOutFakeUser()
  } else {
    signInAsFakeUser(options.user ?? {})
  }

  const navigation = createHarnessNavigation(url)
  const router = createRouter({
    routeTree: buildSquadsRouteTree(),
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
