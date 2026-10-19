/**
 * The old app's router across mounts of the catch-all (CCC-76). Next writes the URL itself, without
 * telling the old app's router, so each mount of the catch-all renders the URL it mounts at.
 */

import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { navigateTo } from '@/lib/navigation'

// The shell renders the old app's routes, so the suite's stand-in tree replaces the real route table.
vi.mock('@/routeTree.gen', async () => {
  const { legacyRouteTree } = await import('./legacy-routes')
  return { routeTree: legacyRouteTree({ landing: true }) }
})

/** The Next router's push, which writes the URL on the real browser history. */
const nextRouter = {
  push: (href: string) => window.history.pushState(null, '', href),
}

beforeEach(() => {
  window.history.replaceState(null, '', '/rooms')
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('the catch-all mounts the old app', () => {
  it('renders the URL of each mount after the Next router moved it', async () => {
    // The catch-all loads the shell when it mounts, so the shell is imported at the first mount's URL.
    const { default: AppShell } = await import('@/app-shell')
    const first = render(<AppShell />)
    expect(await screen.findByText('Squads page')).toBeInTheDocument()

    // A path the old app does not own goes out through the Next router, and the catch-all unmounts.
    navigateTo('/about', nextRouter)
    first.unmount()

    // The Next router moves the URL to another old-app path, and the catch-all mounts there.
    nextRouter.push('/rooms/my')
    render(<AppShell />)

    expect(await screen.findByText('My squads page')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/rooms/my')
  })

  it('follows the browser history under StrictMode, where effects run twice', async () => {
    const { default: AppShell } = await import('@/app-shell')
    render(
      <StrictMode>
        <AppShell />
      </StrictMode>
    )
    expect(await screen.findByText('Squads page')).toBeInTheDocument()

    // The old app owns this path, so its router navigates and writes the URL.
    navigateTo('/rooms/my', nextRouter)
    expect(await screen.findByText('My squads page')).toBeInTheDocument()

    window.history.back()
    expect(await screen.findByText('Squads page')).toBeInTheDocument()
  })
})
