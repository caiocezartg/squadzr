/**
 * The old app's router across mounts of the catch-all (CCC-76). Next writes the URL itself, without
 * telling the old app's router, so each mount of the catch-all renders the URL it mounts at.
 */

import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { navigateTo } from '@/lib/navigation'

// The shell renders the old app's routes, so the suite's stand-in tree replaces the real route table.
vi.mock('@/routeTree.gen', async () => {
  const { legacyRouteTree } = await import('./legacy-routes')
  return { routeTree: legacyRouteTree() }
})

/** The Next router's push, which writes the URL on the real browser history. */
const nextRouter = {
  push: (href: string) => window.history.pushState(null, '', href),
}

beforeEach(() => {
  // The Lobby's path: the old app owns no route on it.
  window.history.replaceState(null, '', '/squads/ABC123')
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('the catch-all mounts the old app', () => {
  it('renders the URL of each mount after the Next router moved it', async () => {
    // The catch-all loads the shell when it mounts, so the shell is imported at the first mount's URL.
    const { default: AppShell } = await import('@/app-shell')
    const first = render(<AppShell />)
    expect(screen.queryByText('Legacy page')).not.toBeInTheDocument()

    // A path the old app does not own goes out through the Next router, and the catch-all unmounts.
    navigateTo('/about', nextRouter)
    first.unmount()

    // The Next router moves the URL to the old app's route, and the catch-all mounts there.
    nextRouter.push('/legacy')
    render(<AppShell />)

    expect(await screen.findByText('Legacy page')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/legacy')
  })

  it('follows the browser history under StrictMode, where effects run twice', async () => {
    const { default: AppShell } = await import('@/app-shell')
    render(
      <StrictMode>
        <AppShell />
      </StrictMode>
    )
    expect(screen.queryByText('Legacy page')).not.toBeInTheDocument()

    // The old app owns this path, so its router navigates and writes the URL.
    navigateTo('/legacy', nextRouter)
    expect(await screen.findByText('Legacy page')).toBeInTheDocument()

    window.history.back()
    await waitFor(() => expect(screen.queryByText('Legacy page')).not.toBeInTheDocument())
    expect(window.location.pathname).toBe('/squads/ABC123')
  })
})
