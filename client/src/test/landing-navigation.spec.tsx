/**
 * Links to the landing and from it (CCC-77). The landing is an App Router page, so every path that
 * sends the player to `/` goes through the Next router, and the old app never handles that path.
 */

import { RouterProvider, createRootRoute, createRouter } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HeroSection } from '@/components/landing/hero-section'
import { NotFound } from '@/components/ui/not-found'
import { renderSquadsFlow } from './harness'
import { createHarnessNavigation } from './navigation'

describe('links to the landing', () => {
  it('sends a signed-out visitor of My Squads to the App Router landing', async () => {
    const { navigation } = renderSquadsFlow('/rooms/my', { user: null })

    await waitFor(() => expect(navigation.calls).toEqual([{ method: 'push', href: '/' }]))
  })

  it('sends the not-found page home link to the App Router landing', async () => {
    const navigation = createHarnessNavigation('/missing')
    const rootRoute = createRootRoute({ component: NotFound })
    const router = createRouter({ routeTree: rootRoute, history: navigation.history })
    const user = userEvent.setup({ delay: null })
    render(<RouterProvider router={router} />)

    await user.click(await screen.findByRole('link', { name: 'Back to Home' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/' }])
  })
})

describe('links from the landing', () => {
  it('sends the hero call to explore squads to the Next router', async () => {
    const navigation = createHarnessNavigation('/')
    const user = userEvent.setup({ delay: null })
    render(<HeroSection gameCount={0} />)

    await user.click(screen.getByRole('link', { name: 'Explore squads' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads' }])
  })
})
