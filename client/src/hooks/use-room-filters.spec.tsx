import { act, cleanup, render } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { roomsSearchSchema } from '@/lib/rooms-search'
import { useRoomFilters } from './use-room-filters'

async function renderFilters(url = '/rooms') {
  let filters: ReturnType<typeof useRoomFilters>
  const rootRoute = createRootRoute({ component: Outlet })
  const roomsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/',
    validateSearch: (raw) => roomsSearchSchema.parse(raw),
    component: function FilterProbe() {
      filters = useRoomFilters(new Map())
      return null
    },
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([roomsRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  })

  await router.load()
  vi.useFakeTimers()
  render(<RouterProvider router={router} />)

  return { router, getFilters: () => filters }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('room filter debounce', () => {
  it('keeps a page selected before the mount debounce deadline', async () => {
    const { getFilters } = await renderFilters()

    await act(async () => getFilters().setPage(2))
    expect(getFilters().page).toBe(2)

    await act(async () => vi.advanceTimersByTime(300))
    expect(getFilters().page).toBe(2)
  })

  it.each(['', '&search=Ranked&tag=duo'])(
    'preserves the page from a shared URL with matching input values (%s)',
    async (query) => {
      const { getFilters } = await renderFilters(`/rooms?page=2${query}`)

      await act(async () => vi.advanceTimersByTime(300))
      expect(getFilters().page).toBe(2)
    }
  )

  it.each(['search', 'tag'] as const)(
    'debounces an edited %s and resets the page only once',
    async (field) => {
      const { getFilters, router } = await renderFilters('/rooms?page=2')

      act(() => {
        if (field === 'search') getFilters().setLocalSearch('Ranked')
        else getFilters().setLocalTag('Ranked')
      })
      await act(async () => vi.advanceTimersByTime(299))
      expect(router.state.location.search[field]).toBeUndefined()
      expect(getFilters().page).toBe(2)

      await act(async () => vi.advanceTimersByTime(1))
      expect(router.state.location.search[field]).toBe('Ranked')
      expect(getFilters().page).toBe(1)

      await act(async () => getFilters().setPage(2))
      await act(async () => vi.advanceTimersByTime(300))
      expect(getFilters().page).toBe(2)
    }
  )

  it('syncs URL navigation to both inputs without resetting its page', async () => {
    const { getFilters, router } = await renderFilters()

    await act(async () => {
      router.history.push('/rooms?search=Ranked&tag=duo&page=3')
    })
    expect(getFilters().localSearch).toBe('Ranked')
    expect(getFilters().localTag).toBe('duo')

    await act(async () => vi.advanceTimersByTime(300))
    expect(getFilters().page).toBe(3)
  })
})
