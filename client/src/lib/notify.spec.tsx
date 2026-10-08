/**
 * Error toast queue (CCC-43 follow-up).
 *
 * Sonner's Toaster only receives toasts published after it subscribed. An
 * error raised while its chunk is still in flight is published immediately and
 * replayed with the same id when the host mounts, so it is not lost and is not
 * duplicated. A failed runtime import must never become an unhandled
 * rejection.
 */

import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppToaster, MAX_PENDING_TOASTS } from '@/lib/toast-runtime'
import { notifyError } from '@/lib/notify'
import { toastStore } from '@/test/stubs'

describe('notifyError', () => {
  it('replays a toast emitted before the Toaster mounts when it mounts', async () => {
    await notifyError('early failure')

    // Published while no Toaster was subscribed: Sonner stored it but nothing
    // could render it.
    expect(toastStore.errorCalls).toEqual(['early failure'])

    render(<AppToaster theme="dark" position="top-center" richColors />)

    // The host republishes the pending error; a mounted Toaster receives it.
    await waitFor(() => expect(toastStore.errorCalls).toEqual(['early failure', 'early failure']))
  })

  it('replays the early toast with the same id, so Sonner updates instead of duplicating', async () => {
    await notifyError('early failure')

    const [published] = toastStore.errorToasts
    expect(published?.message).toBe('early failure')
    expect(published?.id).toBeTruthy()

    render(<AppToaster theme="dark" position="top-center" richColors />)

    await waitFor(() => expect(toastStore.errorToasts).toHaveLength(2))
    const [, replayed] = toastStore.errorToasts
    expect(replayed?.message).toBe('early failure')
    expect(replayed?.id).toBe(published?.id)
  })

  it('keeps only the most recent errors when the replay queue is full', async () => {
    const total = MAX_PENDING_TOASTS + 3
    for (let i = 0; i < total; i += 1) await notifyError(`failure ${i}`)

    // Every error is published immediately...
    expect(toastStore.errorCalls).toHaveLength(total)

    render(<AppToaster theme="dark" position="top-center" richColors />)

    // ...but the host only replays the most recent MAX_PENDING_TOASTS.
    await waitFor(() => expect(toastStore.errorCalls).toHaveLength(total + MAX_PENDING_TOASTS))
    const replayed = toastStore.errorToasts.slice(total)
    expect(replayed.map((call) => call.message)).toEqual(
      Array.from(
        { length: MAX_PENDING_TOASTS },
        (_, i) => `failure ${total - MAX_PENDING_TOASTS + i}`
      )
    )
  })

  it('swallows a failed toast runtime import instead of rejecting', async () => {
    vi.resetModules()
    vi.doMock('@/lib/toast-runtime', () => {
      throw new Error('toast runtime chunk failed')
    })

    try {
      const { notifyError: notifyErrorWithFailingRuntime } = await import('@/lib/notify')

      await expect(notifyErrorWithFailingRuntime('boom')).resolves.toBeUndefined()
    } finally {
      vi.doUnmock('@/lib/toast-runtime')
    }
  })
})
