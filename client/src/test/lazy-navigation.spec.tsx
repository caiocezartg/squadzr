/**
 * On-demand routes (CCC-43).
 *
 * The production build splits every route component into its own chunk
 * (TanStack Router auto code splitting). These tests mount the real router
 * primitives the app uses — `lazyRouteComponent` and the app router's pending
 * defaults (`src/router.tsx`) — with a controllable dynamic import, so the
 * navigation to an unloaded route is observable: the pending state shows while
 * the chunk is in flight, then the page renders. The pending paths are driven
 * with fake timers at the TanStack Router defaults the app relies on (1000 ms
 * `pendingMs`, 500 ms `pendingMinMs`); no test overrides those values.
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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routerDefaults } from '@/router'
import { roomsSearchSchema } from '@/features/room-list'
import type { CatalogPage } from '@/features/catalog'
import { createTestQueryClient } from './harness'
import { httpOk, onHttp } from './http-router'
import { catalogGames, catalogRooms } from './fixtures'

type CatalogModule = { CatalogPage: typeof CatalogPage }

/** TanStack Router defaults; `src/router.tsx` deliberately does not override them. */
const PENDING_MS = 1_000
const PENDING_MIN_MS = 500

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
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
  initialEntry: string
): { router: Router<AnyRoute>; queryClient: QueryClient } {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree: buildFlowTree(loadCatalog),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    ...routerDefaults,
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
  it('shows the pending state while the chunk outlives the default delay, then renders the page', async () => {
    const catalogModule = await import('@/features/catalog')
    vi.useFakeTimers()
    try {
      const catalogImport = deferred<CatalogModule>()
      const { router } = renderFlow(() => catalogImport.promise, '/')
      await act(async () => {})
      expect(screen.getByText('Landing stub')).toBeInTheDocument()

      let navigation: Promise<void> | undefined
      await act(async () => {
        navigation = router.navigate({ to: '/rooms', search: {} })
      })

      // Below the 1000 ms default the loading state stays hidden.
      expect(screen.queryByTestId('route-pending')).not.toBeInTheDocument()
      expect(screen.queryByText('Ranked grind')).not.toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PENDING_MS)
      })
      expect(screen.getByTestId('route-pending')).toBeInTheDocument()
      expect(screen.queryByText('Ranked grind')).not.toBeInTheDocument()

      // The chunk lands, but the pending state respects its 500 ms minimum.
      await act(async () => {
        catalogImport.resolve(catalogModule)
        await vi.advanceTimersByTimeAsync(PENDING_MIN_MS)
        await navigation
      })

      // The mounted page then resolves its own data queries.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText('Ranked grind')).toBeInTheDocument()
      expect(screen.queryByTestId('route-pending')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders directly on an on-demand route when its chunk resolves before paint', async () => {
    const catalogModule = await import('@/features/catalog')
    renderFlow(() => Promise.resolve(catalogModule), '/rooms')

    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByTestId('route-pending')).not.toBeInTheDocument()
  })

  it('does not show the pending state when the chunk resolves below the default delay', async () => {
    const catalogModule = await import('@/features/catalog')
    vi.useFakeTimers()
    try {
      const { router } = renderFlow(() => Promise.resolve(catalogModule), '/')
      await act(async () => {})
      expect(screen.getByText('Landing stub')).toBeInTheDocument()

      let navigation: Promise<void> | undefined
      await act(async () => {
        navigation = router.navigate({ to: '/rooms', search: {} })
        await navigation
      })

      // The mounted page then resolves its own data queries.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText('Ranked grind')).toBeInTheDocument()
      expect(screen.queryByTestId('route-pending')).not.toBeInTheDocument()

      // No delayed pending state shows up once the chunk already resolved.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PENDING_MS * 2)
      })
      expect(screen.getByText('Ranked grind')).toBeInTheDocument()
      expect(screen.queryByTestId('route-pending')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the TanStack Router pending delays without overriding them', () => {
    expect(routerDefaults).not.toHaveProperty('defaultPendingMs')
    expect(routerDefaults).not.toHaveProperty('defaultPendingMinMs')
  })
})
