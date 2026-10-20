/**
 * Route skeletons (CCC-43 follow-up).
 *
 * The data-heavy routes declare their page skeleton as `pendingComponent`
 * (`src/routes/rooms/*`), so the skeleton shown while the route is held back
 * is the same markup the page shows while its data loads: one continuous
 * loading phase, no swap. The Squad Board is an App Router page with no
 * loading file of its own: its list shows the same skeleton while the list
 * loads, under the title and the filters, so the skeleton never covers squads
 * the cache already holds. Each test mounts a route with the real
 * `pendingComponent`, a deferred lazy component and deferred HTTP handlers,
 * then walks the three states: route pending → skeleton, page mounted with
 * data pending → the same skeleton, data loaded → the page.
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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
import MySquadsLoading from '@/app/squads/my/loading'
import { LobbySkeleton } from '@/features/lobby/skeleton'
import { MySquadsPage } from '@/features/my-squads/page'
import { SquadBoardPage } from '@/features/squad-board/page'
import { squadsSearchSchema } from '@/features/squad-list'
import type { LobbyPage } from '@/features/lobby'
import { createTestQueryClient } from './harness'
import { httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import { boardGames, boardSquads, gameLol, lobbySquad, lobbyRoomResponse } from './fixtures'
import { createHarnessNavigation } from './navigation'
import { signInAsFakeUser } from './stubs'

type LobbyModule = { LobbyPage: typeof LobbyPage }

/** TanStack Router defaults the app relies on (`src/router.tsx` keeps them). */
const PENDING_MS = 1_000
const PENDING_MIN_MS = 500

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

/** The board mounted where its App Router page sits: the page renders its own loading state and data. */
function buildBoardTree(): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const boardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/squads',
    component: SquadBoardPage,
  })
  return rootRoute.addChildren([boardRoute]) as AnyRoute
}

function buildLobbyTree(load: () => Promise<LobbyModule>): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const lobbyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/squads/$code',
    component: lazyRouteComponent(
      () =>
        load().then(({ LobbyPage }) => ({
          LobbyRoute: function LobbyRoute() {
            const { code } = lobbyRoute.useParams()
            return <LobbyPage squadCode={code} />
          },
        })),
      'LobbyRoute'
    ),
    pendingComponent: LobbySkeleton,
  })
  return rootRoute.addChildren([lobbyRoute]) as AnyRoute
}

function buildMySquadsTree(): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const mySquadsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/squads/my',
    validateSearch: (raw) => squadsSearchSchema.parse(raw),
    component: MySquadsPage,
  })
  return rootRoute.addChildren([mySquadsRoute]) as AnyRoute
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
  it('has no route-level loading state, so the skeleton never covers squads the cache holds', () => {
    expect(existsSync(join(SRC_DIR, 'app/squads/loading.tsx'))).toBe(false)
  })

  it('keeps the board skeleton through the data load, then shows the board', async () => {
    const roomsResponse = deferred<MockHttpResponse>()
    const gamesResponse = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms', () => roomsResponse.promise)
    onHttp('GET', '/api/games', () => gamesResponse.promise)
    createHarnessNavigation('/squads')
    mountFlow(buildBoardTree(), '/squads')

    expect(await screen.findByTestId('squad-board-skeleton')).toBeInTheDocument()

    // The data lands: the skeleton gives way to the board.
    roomsResponse.resolve(httpOk(boardSquads))
    gamesResponse.resolve(httpOk(boardGames))
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByTestId('squad-board-skeleton')).not.toBeInTheDocument()
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
        `/squads/${lobbySquad.code}`
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
      expect(screen.queryByText(lobbySquad.name)).not.toBeInTheDocument()

      await act(async () => {
        roomResponse.resolve(httpOk(lobbyRoomResponse))
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText(lobbySquad.name)).toBeInTheDocument()
      expect(screen.queryByTestId('lobby-skeleton')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("shows My Squads' loading UI with the skeleton the page also uses", async () => {
    render(<MySquadsLoading />)

    expect(screen.getByTestId('my-squads-skeleton')).toBeInTheDocument()
  })

  it('keeps the My Squads skeleton through the data load, then shows the lists', async () => {
    const mySquadsResponse = deferred<MockHttpResponse>()
    const gamesResponse = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/my', () => mySquadsResponse.promise)
    onHttp('GET', '/api/games', () => gamesResponse.promise)

    signInAsFakeUser()
    mountFlow(buildMySquadsTree(), '/squads/my')

    expect(await screen.findByTestId('my-squads-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('Created (0)')).not.toBeInTheDocument()

    await act(async () => {
      mySquadsResponse.resolve(httpOk({ hosted: [], joined: [] }))
      gamesResponse.resolve(httpOk(boardGames))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(await screen.findByText('My squads')).toBeInTheDocument()
    expect(screen.queryByTestId('my-squads-skeleton')).not.toBeInTheDocument()
  })
})
