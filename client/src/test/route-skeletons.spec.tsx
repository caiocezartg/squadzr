/**
 * Route skeletons (CCC-43 follow-up).
 *
 * The data-heavy routes declare their page skeleton as `pendingComponent`
 * (`src/routes/rooms/*`), so the skeleton shown while the route is held back
 * is the same markup the page shows while its data loads: one continuous
 * loading phase, no swap. Each test mounts a route with the real
 * `pendingComponent`, a deferred lazy component and deferred HTTP handlers,
 * then walks the three states: route pending → skeleton, page mounted with
 * data pending → the same skeleton, data loaded → the page.
 */

import { StrictMode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'
import type { AnyRoute } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Route as RoomsIndexRoute } from '@/routes/rooms/index'
import { Route as RoomsCodeRoute } from '@/routes/rooms/$code'
import { Route as RoomsMyRoute } from '@/routes/rooms/my'
import type { CatalogPage } from '@/features/catalog'
import type { LobbyPage } from '@/features/lobby'
import type { MyRoomsPage } from '@/features/my-rooms'
import { createTestQueryClient } from './harness'
import { httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import { catalogGames, catalogRooms, gameLol, lobbyRoom, lobbyRoomResponse } from './fixtures'
import { signInAsFakeUser } from './stubs'

type CatalogModule = { CatalogPage: typeof CatalogPage }
type LobbyModule = { LobbyPage: typeof LobbyPage }
type MyRoomsModule = { MyRoomsPage: typeof MyRoomsPage }

/** TanStack Router defaults the app relies on (`src/router.tsx` keeps them). */
const PENDING_MS = 1_000
const PENDING_MIN_MS = 500

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function mountFlow(routeTree: AnyRoute, initialEntry: string): void {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })

  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  )
}

function buildCatalogTree(load: () => Promise<CatalogModule>): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const catalogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/',
    validateSearch: RoomsIndexRoute.options.validateSearch,
    component: lazyRouteComponent(load, 'CatalogPage'),
    pendingComponent: RoomsIndexRoute.options.pendingComponent,
  })
  return rootRoute.addChildren([catalogRoute]) as AnyRoute
}

function buildLobbyTree(load: () => Promise<LobbyModule>): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const lobbyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/$code',
    component: lazyRouteComponent(
      () =>
        load().then(({ LobbyPage }) => ({
          LobbyRoute: function LobbyRoute() {
            const { code } = lobbyRoute.useParams()
            return <LobbyPage roomCode={code} />
          },
        })),
      'LobbyRoute'
    ),
    pendingComponent: RoomsCodeRoute.options.pendingComponent,
  })
  return rootRoute.addChildren([lobbyRoute]) as AnyRoute
}

function buildMyRoomsTree(load: () => Promise<MyRoomsModule>): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const myRoomsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/my',
    validateSearch: RoomsMyRoute.options.validateSearch,
    component: lazyRouteComponent(load, 'MyRoomsPage'),
    pendingComponent: RoomsMyRoute.options.pendingComponent,
  })
  return rootRoute.addChildren([myRoomsRoute]) as AnyRoute
}

/** Mounts at a held route and drives the pending delay so the skeleton shows. */
async function reachPendingSkeleton(testId: string): Promise<void> {
  await act(async () => {})
  await act(async () => {
    await vi.advanceTimersByTimeAsync(PENDING_MS)
  })
  expect(screen.getByTestId(testId)).toBeInTheDocument()
}

describe('route skeletons', () => {
  it('keeps the catalog skeleton from the route pending state through the data load', async () => {
    const catalogModule = await import('@/features/catalog')
    const roomsResponse = deferred<MockHttpResponse>()
    const gamesResponse = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms', () => roomsResponse.promise)
    onHttp('GET', '/api/games', () => gamesResponse.promise)

    vi.useFakeTimers()
    try {
      const catalogImport = deferred<CatalogModule>()
      mountFlow(
        buildCatalogTree(() => catalogImport.promise),
        '/rooms/'
      )
      await reachPendingSkeleton('catalog-skeleton')

      // The chunk lands but the page data is still pending: same skeleton.
      await act(async () => {
        catalogImport.resolve(catalogModule)
        await vi.advanceTimersByTimeAsync(PENDING_MIN_MS)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByTestId('catalog-skeleton')).toBeInTheDocument()
      expect(screen.queryByText('Ranked grind')).not.toBeInTheDocument()

      // The data lands: the skeleton gives way to the page.
      await act(async () => {
        roomsResponse.resolve(httpOk(catalogRooms))
        gamesResponse.resolve(httpOk(catalogGames))
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText('Ranked grind')).toBeInTheDocument()
      expect(screen.queryByTestId('catalog-skeleton')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the lobby skeleton from the route pending state through the data load', async () => {
    const lobbyModule = await import('@/features/lobby')
    const roomResponse = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/:code', () => roomResponse.promise)
    onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))

    vi.useFakeTimers()
    try {
      signInAsFakeUser()
      const lobbyImport = deferred<LobbyModule>()
      mountFlow(
        buildLobbyTree(() => lobbyImport.promise),
        `/rooms/${lobbyRoom.code}`
      )
      await reachPendingSkeleton('lobby-skeleton')

      await act(async () => {
        lobbyImport.resolve(lobbyModule)
        await vi.advanceTimersByTimeAsync(PENDING_MIN_MS)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByTestId('lobby-skeleton')).toBeInTheDocument()
      expect(screen.queryByText(lobbyRoom.name)).not.toBeInTheDocument()

      await act(async () => {
        roomResponse.resolve(httpOk(lobbyRoomResponse))
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText(lobbyRoom.name)).toBeInTheDocument()
      expect(screen.queryByTestId('lobby-skeleton')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the My squads skeleton from the route pending state through the data load', async () => {
    const myRoomsModule = await import('@/features/my-rooms')
    const myRoomsResponse = deferred<MockHttpResponse>()
    const gamesResponse = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/my', () => myRoomsResponse.promise)
    onHttp('GET', '/api/games', () => gamesResponse.promise)

    vi.useFakeTimers()
    try {
      signInAsFakeUser()
      const myRoomsImport = deferred<MyRoomsModule>()
      mountFlow(
        buildMyRoomsTree(() => myRoomsImport.promise),
        '/rooms/my'
      )
      await reachPendingSkeleton('my-rooms-skeleton')

      await act(async () => {
        myRoomsImport.resolve(myRoomsModule)
        await vi.advanceTimersByTimeAsync(PENDING_MIN_MS)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByTestId('my-rooms-skeleton')).toBeInTheDocument()
      expect(screen.queryByText('My squads')).not.toBeInTheDocument()

      await act(async () => {
        myRoomsResponse.resolve(httpOk({ hosted: [], joined: [] }))
        gamesResponse.resolve(httpOk(catalogGames))
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText('My squads')).toBeInTheDocument()
      expect(screen.queryByTestId('my-rooms-skeleton')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
