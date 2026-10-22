import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRealtimeUpdateNotice,
  getServerRealtimeUpdateNotice,
  setRealtimeUpdateNotice,
  subscribeToRealtimeUpdateNotice,
} from './realtime-update-store'

afterEach(() => {
  setRealtimeUpdateNotice(null)
})

describe('realtime update notice store', () => {
  it('starts empty, on the server and in the browser', () => {
    expect(getRealtimeUpdateNotice()).toBeNull()
    expect(getServerRealtimeUpdateNotice()).toBeNull()
  })

  it('notifies subscribers when the state changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToRealtimeUpdateNotice(listener)

    setRealtimeUpdateNotice('reloading')
    setRealtimeUpdateNotice('manual')

    expect(getRealtimeUpdateNotice()).toBe('manual')
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('does not notify when the state is unchanged or after unsubscribing', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToRealtimeUpdateNotice(listener)

    setRealtimeUpdateNotice(null)
    unsubscribe()
    setRealtimeUpdateNotice('manual')

    expect(listener).not.toHaveBeenCalled()
  })
})
