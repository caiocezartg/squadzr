/**
 * Toast entry point.
 *
 * Toasts are a non-essential capability: the Sonner runtime is imported when
 * an error actually needs to be surfaced, so it stays out of the initial
 * JavaScript of every route.
 */
export function notifyError(message: string): Promise<void> {
  return import('sonner').then(({ toast }) => {
    toast.error(message)
  })
}
