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
import { AppToaster } from '@/lib/toast-runtime'
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
