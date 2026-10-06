import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Route loading state: shown by the router while an on-demand route chunk is
 * fetched, so a navigation never swaps to a blank page.
 */
export function RoutePending() {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="route-pending"
      className="flex min-h-[50vh] items-center justify-center gap-2 px-4 text-sm text-muted"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{t('common.loading')}</span>
    </div>
  )
}
