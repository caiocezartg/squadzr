/**
 * Error toasts (CCC-71). The Toaster is mounted eagerly in the root layout, so `notifyError` hands
 * the message to Sonner at once: the toast shows on the first failure, with no replay queue.
 */

import { describe, expect, it } from 'vitest'
import { notifyError } from '@/lib/notify'
import { toastStore } from '@/test/stubs'

describe('notifyError', () => {
  it('shows the error toast on the first failure', () => {
    notifyError('first failure')

    expect(toastStore.errorCalls).toEqual(['first failure'])
  })

  it('shows every failure as its own toast, in order, without a cap', () => {
    const failures = Array.from({ length: 8 }, (_, i) => `failure ${i}`)

    for (const failure of failures) notifyError(failure)

    expect(toastStore.errorCalls).toEqual(failures)
  })
})
