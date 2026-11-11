import { toast } from 'sonner'

/**
 * Shows an error toast. It is the only way the client shows one, so every failure reads the same
 * wherever it comes from. The Toaster is mounted eagerly in the root layout, so the toast shows on
 * the first failure.
 */
export function notifyError(message: string): void {
  toast.error(message)
}
