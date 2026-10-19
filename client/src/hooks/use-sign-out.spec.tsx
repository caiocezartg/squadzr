/**
 * Signing out from the header (CCC-77). The viewer leaves the signed-in state without a full page load:
 * the session ends, the query cache is cleared, the screen that owns a realtime connection goes away, and
 * the player lands on `/` through the navigation helper.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { AnyRoute } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppHeader } from '@/components/layout/app-header'
import { WS_URL } from '@/env'
import { useWebSocket } from '@/hooks/use-websocket'
import { createTestQueryClient } from '@/test/harness'
import { httpOk, onHttp } from '@/test/http-router'
import { createHarnessNavigation } from '@/test/navigation'
import { RegisterLegacyNavigator } from '@/test/shell'
import { signInAsFakeUser } from '@/test/stubs'
import { MockWebSocket, latestWebSocket } from '@/test/ws-mock'

/** A screen with a realtime connection, as the squads page and the lobby open one. */
function RealtimeScreen() {
  useWebSocket({ url: WS_URL })
  return <p>Squads page</p>
}

function squadsRouteTree(): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const squadsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/',
    component: RealtimeScreen,
  })

  return rootRoute.addChildren([squadsRoute]) as AnyRoute
}

/** The header over the squads page, as the root layout mounts it over the old app. */
function renderHeaderOver(url: string) {
  const navigation = createHarnessNavigation(url)
  const queryClient = createTestQueryClient()
  const router = createRouter({ routeTree: squadsRouteTree(), history: navigation.history })

  render(
    <QueryClientProvider client={queryClient}>
      <AppHeader />
      <main>
        <RouterProvider router={router} />
      </main>
      <RegisterLegacyNavigator router={router} />
    </QueryClientProvider>
  )

  return { user: userEvent.setup({ delay: null }), navigation, queryClient }
}

/** Opens the user menu in the header and picks Sign Out. */
async function signOutFromHeader(user: UserEvent): Promise<void> {
  const header = within(screen.getByRole('banner'))
  await user.click(header.getByRole('button', { name: /caio/i }))
  await user.click(header.getByRole('button', { name: 'Sign Out' }))
}

beforeEach(() => {
  onHttp('GET', '/api/notifications', () => httpOk({ notifications: [] }))
})

describe('signing out from the header', () => {
  it('ends the session, clears the cached data and sends the player to the landing', async () => {
    signInAsFakeUser({ name: 'Caio' })
    const { user, navigation, queryClient } = renderHeaderOver('/rooms')
    queryClient.setQueryData(['my-squads'], [])

    await signOutFromHeader(user)

    await waitFor(() => expect(navigation.calls).toContainEqual({ method: 'push', href: '/' }))
    expect(navigation.history.location.pathname).toBe('/')
    expect(queryClient.getQueryData(['my-squads'])).toBeUndefined()
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Sign In' })
    ).toBeVisible()
  })

  it('closes the realtime connection of the screen the viewer leaves', async () => {
    signInAsFakeUser({ name: 'Caio' })
    const { user, navigation } = renderHeaderOver('/rooms')
    await screen.findByText('Squads page')
    const socket = latestWebSocket()
    socket.open()

    await signOutFromHeader(user)

    await waitFor(() => expect(navigation.calls).toContainEqual({ method: 'push', href: '/' }))
    expect(socket.readyState).toBe(MockWebSocket.CLOSED)
  })
})
