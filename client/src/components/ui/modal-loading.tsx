import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Loading state for on-demand dialogs: rendered while the dialog capability
 * chunk is fetched, so opening it never shows a frozen page.
 */
export function ModalLoading() {
  const t = useTranslations()

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="modal-loading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs"
    >
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted shadow-2xl shadow-black/50">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span>{t('common.loading')}</span>
      </div>
    </div>
  )
}
