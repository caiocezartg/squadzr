/**
 * The harness location: `next/navigation` and `next/link` read and write the one in-memory location,
 * and every call made through the Next router is recorded in order.
 */

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createHarnessNavigation } from './navigation'

function NavigationProbe() {
  const router = useRouter()

  return (
    <>
      <button type="button" onClick={() => router.push('/squads/my')}>
        Push my squads
      </button>
      <button type="button" onClick={() => router.replace('/squads/LOBBY1')}>
        Replace with lobby
      </button>
      <button type="button" onClick={() => router.back()}>
        Go back
      </button>
      <button type="button" onClick={() => router.forward()}>
        Go forward
      </button>
      <button type="button" onClick={() => router.refresh()}>
        Refresh route
      </button>
      <Link href="/squads/LOBBY1">Open lobby</Link>
    </>
  )
}

describe('harness navigation', () => {
  it('updates the one in-memory location from a next/navigation push and a next/link click', async () => {
    const navigation = createHarnessNavigation('/squads')
    const user = userEvent.setup({ delay: null })
    render(<NavigationProbe />)

    await user.click(screen.getByRole('button', { name: 'Push my squads' }))
    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads/my'))

    await user.click(screen.getByRole('link', { name: 'Open lobby' }))
    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads/LOBBY1'))
    expect(navigation.calls).toEqual([
      { method: 'push', href: '/squads/my' },
      { method: 'push', href: '/squads/LOBBY1' },
    ])
  })

  it('records replace, back, forward and a route refresh on the same location', async () => {
    const navigation = createHarnessNavigation('/squads')
    const user = userEvent.setup({ delay: null })
    render(<NavigationProbe />)

    await user.click(screen.getByRole('button', { name: 'Push my squads' }))
    await user.click(screen.getByRole('button', { name: 'Replace with lobby' }))
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    await user.click(screen.getByRole('button', { name: 'Go forward' }))
    await user.click(screen.getByRole('button', { name: 'Refresh route' }))

    expect(navigation.calls.map((call) => call.method)).toEqual([
      'push',
      'replace',
      'back',
      'forward',
      'refresh',
    ])
    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads/LOBBY1'))
  })

  it('leaves a modified click to the browser, as an anchor does', () => {
    const navigation = createHarnessNavigation('/squads')
    render(<NavigationProbe />)
    const link = screen.getByRole('link', { name: 'Open lobby' })

    // jsdom cannot navigate. The listener records whether the harness cancelled the click, then
    // cancels it, so jsdom does not log a navigation it cannot perform.
    let cancelledByHarness: boolean | undefined
    document.addEventListener(
      'click',
      (event) => {
        cancelledByHarness = event.defaultPrevented
        event.preventDefault()
      },
      { once: true }
    )

    fireEvent.click(link, { ctrlKey: true })

    expect(link).toHaveAttribute('href', '/squads/LOBBY1')
    expect(cancelledByHarness).toBe(false)
    expect(navigation.calls).toEqual([])
    expect(navigation.history.location.pathname).toBe('/squads')
  })
})
