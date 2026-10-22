/**
 * Signing out from the header (CCC-77). The viewer leaves the signed-in state without a full page load:
 * the session ends, the query cache is cleared, the screen that owns a realtime connection goes away, and
 * the player lands on `/` through the navigation helper.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppHeader } from '@/components/layout/app-header'
import { WS_URL } from '@/env'
import { useWebSocket } from '@/hooks/use-websocket'
import en from '@/locales/en.json'
import { createTestQueryClient } from '@/test/harness'
import { httpOk, onHttp } from '@/test/http-router'
import { createHarnessNavigation } from '@/test/navigation'
import { authStore, signInAsFakeUser, toastStore } from '@/test/stubs'
import { MockWebSocket, latestWebSocket } from '@/test/ws-mock'

/** A screen with a realtime connection, as the squads page and the lobby open one. */
function RealtimeScreen() {
  useWebSocket(WS_URL)
  return <p>Squads page</p>
}

/** The header over the page the location names, as the root layout mounts it over the app. */
function HeaderScene() {
  const pathname = usePathname()

  return (
    <>
      <AppHeader />
      <main>{pathname === '/squads' ? <RealtimeScreen /> : <p>Home page</p>}</main>
    </>
  )
}

function renderHeaderOver(url: string) {
  const navigation = createHarnessNavigation(url)
  const queryClient = createTestQueryClient()

  render(
    <QueryClientProvider client={queryClient}>
      <HeaderScene />
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
    const { user, navigation, queryClient } = renderHeaderOver('/squads')
    queryClient.setQueryData(['my-squads'], [])

    await signOutFromHeader(user)

    // The refresh follows the push, so it also drops the back-navigation entry of the screen just left.
    await waitFor(() =>
      expect(navigation.calls.slice(-2)).toEqual([
        { method: 'push', href: '/' },
        { method: 'refresh' },
      ])
    )
    expect(navigation.history.location.pathname).toBe('/')
    expect(queryClient.getQueryData(['my-squads'])).toBeUndefined()
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Sign In' })
    ).toBeVisible()
  })

  it('closes the realtime connection of the screen the viewer leaves', async () => {
    signInAsFakeUser({ name: 'Caio' })
    const { user, navigation } = renderHeaderOver('/squads')
    await screen.findByText('Squads page')
    const socket = latestWebSocket()
    socket.open()

    await signOutFromHeader(user)

    await waitFor(() => expect(navigation.calls).toContainEqual({ method: 'push', href: '/' }))
    expect(socket.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('keeps the session and says so when the server refuses the sign-out', async () => {
    signInAsFakeUser({ name: 'Caio' })
    authStore.signOutError = { message: 'Sign-out refused' }
    const { user, navigation } = renderHeaderOver('/squads')

    await signOutFromHeader(user)

    await waitFor(() => expect(toastStore.errorCalls).toEqual([en.errors.DEFAULT]))
    expect(within(screen.getByRole('banner')).getByRole('button', { name: /caio/i })).toBeVisible()
    expect(navigation.history.location.pathname).toBe('/squads')
    expect(navigation.calls).not.toContainEqual({ method: 'push', href: '/' })
    expect(navigation.calls).not.toContainEqual({ method: 'refresh' })
  })
})
