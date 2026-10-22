/**
 * The session across the header (CCC-75). The server seeds the session, and the browser's check on
 * focus keeps it current: a session that ends in another tab shows in the header on that check, and
 * the route refreshes so the server renders the same viewer.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/components/layout/app-header'
import { getSession } from '@/lib/auth-client'
import { createTestQueryClient } from './harness'
import { httpOk, onHttp } from './http-router'
import { createHarnessNavigation } from './navigation'
import type { HarnessNavigation } from './navigation'
import { signInAsFakeUser, signOutFakeUser } from './stubs'

function renderHeader(): HarnessNavigation {
  const navigation = createHarnessNavigation('/')

  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AppHeader />
    </QueryClientProvider>
  )

  return navigation
}

/** A focus event is the browser's own check: the session provider answers it with Better Auth. */
function focusWindow(): Promise<void> {
  return act(async () => {
    window.dispatchEvent(new Event('focus'))
  })
}

beforeEach(() => {
  vi.mocked(getSession).mockClear()
  onHttp('GET', '/api/notifications', () => httpOk({ notifications: [] }))
})

describe('header session', () => {
  it('shows the sign-in button once the browser check finds the session ended', async () => {
    signInAsFakeUser({ name: 'Caio' })
    const navigation = renderHeader()
    expect(await screen.findByText('Caio')).toBeInTheDocument()
    // The mount check runs first, so the session ending below is seen only by the focus check.
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

    signOutFakeUser()
    await focusWindow()

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    expect(navigation.calls).toContainEqual({ method: 'refresh' })
  })

  it('keeps the signed-in header and the route when the check still finds the session', async () => {
    signInAsFakeUser({ name: 'Caio' })
    const navigation = renderHeader()
    expect(await screen.findByText('Caio')).toBeInTheDocument()

    await focusWindow()
    // The check is async: wait until Better Auth was asked and its answer was applied.
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

    expect(screen.getByText('Caio')).toBeInTheDocument()
    expect(navigation.calls).not.toContainEqual({ method: 'refresh' })
  })
})
