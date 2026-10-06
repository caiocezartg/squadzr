import { useEffect } from 'react'
import type { ComponentProps } from 'react'
import { Toaster, toast } from 'sonner'

/**
 * Sonner runtime for error toasts.
 *
 * Sonner's Toaster only receives toasts published after it subscribed, so a
 * message emitted while its chunk is still in flight would be stored but never
 * shown. Each error is published immediately with a stable id and kept in the
 * queue below until the host mounts; the host republishes it, and Sonner
 * treats the replay as an update of that id instead of a second toast.
 *
 * `@/lib/notify` reaches this module through a dynamic import, so the Sonner
 * runtime stays out of the initial JavaScript of every route.
 */

const pending: Array<{ id: string; message: string }> = []
let hostMounted = false
let nextToastId = 0

/** Publishes an error toast, replaying it if the Toaster cannot receive it yet. */
export function showErrorToast(message: string): void {
  const id = `squadzr-error-${nextToastId++}`
  toast.error(message, { id })

  if (!hostMounted) pending.push({ id, message })
}

/**
 * The app's Toaster host: it mounts Sonner and replays the errors published
 * before it subscribed. The root route renders it on demand.
 */
export function AppToaster(props: ComponentProps<typeof Toaster>) {
  useEffect(() => {
    hostMounted = true
    for (const { id, message } of pending.splice(0)) toast.error(message, { id })

    return () => {
      hostMounted = false
    }
  }, [])

  return <Toaster {...props} />
}
