/**
 * On-demand routes (CCC-43).
 *
 * The production build splits every route component into its own chunk
 * (TanStack Router auto code splitting). These tests mount the real router
 * primitives the app uses — `lazyRouteComponent`, the app router's pending
 * defaults (`src/router.tsx`) and the real catalog page — with a controllable
 * dynamic import, so the navigation to an unloaded route is observable: the
 * pending state shows while the chunk is in flight, then the page renders.
 */

import { StrictMode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'
import type { AnyRoute, Router } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { RoutePending } from '@/components/route-pending'
import { routerDefaults } from '@/router'
import { roomsSearchSchema } from '@/features/room-list'
import type { CatalogPage } from '@/features/catalog'
import { createTestQueryClient } from './harness'
import { httpOk, onHttp } from './http-router'
import { catalogGames, catalogRooms } from './fixtures'

type CatalogModule = { CatalogPage: typeof CatalogPage }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

interface FlowPendingOptions {
  defaultPendingComponent: typeof RoutePending
  defaultPendingMs: number
  defaultPendingMinMs: number
}

/** The fast pending options the focused tests use to avoid real timers. */
const FAST_PENDING: FlowPendingOptions = {
  defaultPendingComponent: RoutePending,
  defaultPendingMs: 0,
  defaultPendingMinMs: 0,
}

function buildFlowTree(loadCatalog: () => Promise<CatalogModule>): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div>Landing stub</div>,
  })

  const catalogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/',
    validateSearch: (raw) => roomsSearchSchema.parse(raw),
    component: lazyRouteComponent(loadCatalog, 'CatalogPage'),
  })

  return rootRoute.addChildren([indexRoute, catalogRoute]) as AnyRoute
}

function renderFlow(
  loadCatalog: () => Promise<CatalogModule>,
  initialEntry: string,
  pending: FlowPendingOptions = FAST_PENDING
): { router: Router<AnyRoute>; queryClient: QueryClient } {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree: buildFlowTree(loadCatalog),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    ...pending,
  })

  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  )

  return { router, queryClient }
}

beforeEach(() => {
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
})

describe('on-demand route navigation', () => {
  it('shows the pending state while the route chunk loads, then renders the page', async () => {
    const catalogImport = deferred<CatalogModule>()
    const { router } = renderFlow(() => catalogImport.promise, '/')

    expect(await screen.findByText('Landing stub')).toBeInTheDocument()
    expect(screen.queryByTestId('route-pending')).not.toBeInTheDocument()

    let navigation: Promise<void> | undefined
    act(() => {
      navigation = router.navigate({ to: '/rooms', search: {} })
    })

    // The chunk has not resolved yet: the router shows the loading state.
    expect(await screen.findByTestId('route-pending')).toBeInTheDocument()
    expect(screen.queryByText('Ranked grind')).not.toBeInTheDocument()

    await act(async () => {
      catalogImport.resolve(await import('@/features/catalog'))
      await navigation
    })

    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByTestId('route-pending')).not.toBeInTheDocument()
  })

  it('renders directly on an on-demand route when its chunk resolves before paint', async () => {
    const catalogModule = await import('@/features/catalog')
    renderFlow(() => Promise.resolve(catalogModule), '/rooms')

    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByTestId('route-pending')).not.toBeInTheDocument()
  })

  it('shows the pending state with the app router defaults while the route chunk loads', async () => {
    const catalogImport = deferred<CatalogModule>()
    const { router } = renderFlow(() => catalogImport.promise, '/', routerDefaults)

    expect(await screen.findByText('Landing stub')).toBeInTheDocument()

    let navigation: Promise<void> | undefined
    act(() => {
      navigation = router.navigate({ to: '/rooms', search: {} })
    })

    // The pending UI and its timings come from `src/router.tsx`, the same
    // module `main.tsx` uses to build the app router.
    expect(await screen.findByTestId('route-pending')).toBeInTheDocument()
    expect(screen.queryByText('Ranked grind')).not.toBeInTheDocument()

    await act(async () => {
      catalogImport.resolve(await import('@/features/catalog'))
      await navigation
    })

    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByTestId('route-pending')).not.toBeInTheDocument()
  })
})
