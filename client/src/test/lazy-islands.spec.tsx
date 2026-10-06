/**
 * Non-essential lazy islands (CCC-43 follow-up).
 *
 * A failed on-demand chunk import — unstable network, a deploy that replaced
 * the hashed file — must stay local to the island: it disappears (or renders
 * its static fallback) and the page and the header keep rendering instead of
 * the router's default error screen taking over the app.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { AnyRoute } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/components/layout/app-header'
import { Route as RootRoute } from '@/routes/__root'
import { Route as IndexRoute } from '@/routes/index'
import { createTestQueryClient } from './harness'
import { httpOk, onHttp } from './http-router'
import { catalogGames } from './fixtures'
import { signInAsFakeUser } from './stubs'

// Every non-essential island in this scene fails to load.
vi.mock('@/components/layout/notifications-menu', () => {
  throw new Error('notifications chunk failed')
})
vi.mock('@/components/landing/popular-games', () => {
  throw new Error('popular games chunk failed')
})
vi.mock('@/components/landing/faq-section', () => {
  throw new Error('faq chunk failed')
})
vi.mock('sonner', () => {
  throw new Error('sonner chunk failed')
})

function renderScene(tree: AnyRoute): void {
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

/** The header around a page, with a failing notifications island. */
function headerScene(): AnyRoute {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <AppHeader />
        <Outlet />
      </>
    ),
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div>Page content</div>,
  })
  return rootRoute.addChildren([indexRoute]) as AnyRoute
}

/** The real root layout and landing page, with failing sections and toaster. */
function landingScene(): AnyRoute {
  const rootRoute = createRootRoute({ component: RootRoute.options.component })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexRoute.options.component,
  })
  return rootRoute.addChildren([indexRoute]) as AnyRoute
}

beforeEach(() => {
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('non-essential lazy islands', () => {
  it('keeps the header and the page rendered when the notifications chunk fails', async () => {
    signInAsFakeUser()
    renderScene(headerScene())

    expect(await screen.findByText('Page content')).toBeInTheDocument()

    // The failed island falls back to the static disabled bell...
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeDisabled()

    // ...and the header around it keeps working.
    const header = screen.getByRole('banner')
    expect(within(header).getByAltText('Squadzr logo')).toBeInTheDocument()
    expect(within(header).getByRole('link', { name: 'ALL SQUADS' })).toBeInTheDocument()
    expect(within(header).getByText('Caio')).toBeInTheDocument()
  })

  it('keeps the landing rendered when its sections and the toaster chunk fail', async () => {
    renderScene(landingScene())

    // The hero (and its badge island) render, as do the static sections and
    // the footer; only the failed islands are missing.
    expect(await screen.findByRole('link', { name: 'Explore squads' })).toBeInTheDocument()
    expect(screen.getByText('From login to full squad in under a minute.')).toBeInTheDocument()
    expect(screen.getByText(/Built for gamers/)).toBeInTheDocument()
  })
})
