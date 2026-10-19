/**
 * Non-essential lazy islands (CCC-43 follow-up).
 *
 * A failed on-demand chunk import — unstable network, a deploy that replaced
 * the hashed file — must stay local to the island: it disappears (or renders
 * its static fallback) and the page keeps rendering instead of the router's
 * default error screen taking over the app.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { AnyRoute } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route as RootRoute } from '@/routes/__root'
import { Route as IndexRoute } from '@/routes/index'
import { createTestQueryClient } from './harness'
import { httpOk, onHttp } from './http-router'
import { catalogGames } from './fixtures'

// Every non-essential island in this scene fails to load.
vi.mock('@/components/landing/popular-games', () => {
  throw new Error('popular games chunk failed')
})
vi.mock('@/components/landing/faq-section', () => {
  throw new Error('faq chunk failed')
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

/** The real root route and landing page, with failing sections. */
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
  it('keeps the landing rendered when its sections fail', async () => {
    renderScene(landingScene())

    // The hero (and its badge island) render, as do the static sections and
    // the footer; only the failed islands are missing.
    expect(await screen.findByRole('link', { name: 'Explore squads' })).toBeInTheDocument()
    expect(screen.getByText('From login to full squad in under a minute.')).toBeInTheDocument()
    expect(screen.getByText(/Built for gamers/)).toBeInTheDocument()
  })
})
