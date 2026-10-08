/**
 * Toast entry point.
 *
 * Toasts are a non-essential capability: the Sonner runtime is imported when
 * an error actually needs to be surfaced, so it stays out of the initial
 * JavaScript of every route. Until the runtime's Toaster host subscribes, a
 * published error is replayed when the host mounts (see `@/lib/toast-runtime`)
 * instead of being dropped.
 */
export function notifyError(message: string): Promise<void> {
  return import('@/lib/toast-runtime')
    .then(({ showErrorToast }) => {
      showErrorToast(message)
    })
    .catch(() => {
      // A failed toast runtime must not become an unhandled rejection: the
      // error is non-essential and the app keeps working without the toast.
    })
}
