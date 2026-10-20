import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouterHistory } from './router-history'

describe('createRouterHistory', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('applies the router navigations to the browser URL and notifies the router', async () => {
    const history = createRouterHistory()
    const listener = vi.fn()
    history.subscribe(listener)

    history.push('/rooms')

    await vi.waitFor(() => expect(window.location.pathname).toBe('/rooms'))
    expect(listener).toHaveBeenCalled()
    history.destroy()
  })

  it('updates the URL on writes made directly on window.history without notifying the router', () => {
    const history = createRouterHistory()
    const listener = vi.fn()
    history.subscribe(listener)

    window.history.replaceState(null, '', '/squads/my')

    expect(window.location.pathname).toBe('/squads/my')
    expect(listener).not.toHaveBeenCalled()
    history.destroy()
  })
})
