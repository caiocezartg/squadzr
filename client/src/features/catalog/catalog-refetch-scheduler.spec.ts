import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CATALOG_REFETCH_DEBOUNCE_MS,
  CATALOG_REFETCH_MAX_WAIT_MS,
  createCatalogRefetchScheduler,
} from './catalog-refetch-scheduler'

describe('catalog refetch scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces a burst into a single refetch once the events stop', () => {
    const refetch = vi.fn()
    const scheduler = createCatalogRefetchScheduler({ refetch })

    scheduler.schedule()
    vi.advanceTimersByTime(100)
    scheduler.schedule()
    vi.advanceTimersByTime(100)
    scheduler.schedule()

    expect(refetch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(CATALOG_REFETCH_DEBOUNCE_MS - 1)
    expect(refetch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('refetches once per maxWait while the burst keeps resetting the debounce', () => {
    const refetch = vi.fn()
    const scheduler = createCatalogRefetchScheduler({ refetch })

    // An event every 100 ms for two seconds; the debounce never expires.
    for (let elapsed = 0; elapsed <= 2_000; elapsed += 100) {
      scheduler.schedule()
      vi.advanceTimersByTime(100)
    }

    // The maxWait deadlines at 1000 ms and 2000 ms drove the burst.
    expect(refetch).toHaveBeenCalledTimes(2)

    // The events stop; the trailing debounce adds one last refetch.
    vi.advanceTimersByTime(CATALOG_REFETCH_DEBOUNCE_MS)
    expect(refetch).toHaveBeenCalledTimes(3)
  })

  it('cancels the pending refetch without firing it', () => {
    const refetch = vi.fn()
    const scheduler = createCatalogRefetchScheduler({ refetch })

    scheduler.schedule()
    scheduler.cancel()

    vi.advanceTimersByTime(CATALOG_REFETCH_MAX_WAIT_MS * 2)

    expect(refetch).not.toHaveBeenCalled()
  })

  it('cancels a burst that was still resetting the debounce', () => {
    const refetch = vi.fn()
    const scheduler = createCatalogRefetchScheduler({ refetch })

    scheduler.schedule()
    vi.advanceTimersByTime(100)
    scheduler.schedule()
    scheduler.cancel()

    vi.advanceTimersByTime(CATALOG_REFETCH_MAX_WAIT_MS * 2)

    expect(refetch).not.toHaveBeenCalled()
  })

  it('is a no-op once the scheduled refetch already ran', () => {
    const refetch = vi.fn()
    const scheduler = createCatalogRefetchScheduler({ refetch })

    scheduler.schedule()
    vi.advanceTimersByTime(CATALOG_REFETCH_DEBOUNCE_MS)
    expect(refetch).toHaveBeenCalledTimes(1)

    // Nothing to drop: the refetch already ran, so unmounting must not fire
    // a second one.
    scheduler.cancel()
    vi.advanceTimersByTime(CATALOG_REFETCH_MAX_WAIT_MS * 2)
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when no refetch was ever scheduled', () => {
    const refetch = vi.fn()
    const scheduler = createCatalogRefetchScheduler({ refetch })

    scheduler.cancel()
    vi.advanceTimersByTime(CATALOG_REFETCH_MAX_WAIT_MS * 2)
    expect(refetch).not.toHaveBeenCalled()
  })
})
