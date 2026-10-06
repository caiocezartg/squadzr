import { useTranslation } from 'react-i18next'

/**
 * Default route loading state, shown by the router while an on-demand route
 * chunk is fetched. The bar is fixed right below the header (h-14/sm:h-16) and
 * takes no layout space; the empty min-height block keeps the footer from
 * jumping when the bar appears or disappears. CSS-only on purpose: this
 * component ships in the entry chunk, so it must not pull an animation library
 * into the bundle budget.
 */
export function RoutePending() {
  const { t } = useTranslation()

  return (
    <div role="status" aria-live="polite" data-testid="route-pending" className="min-h-[50vh]">
      <span className="sr-only">{t('common.loading')}</span>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-14 z-40 h-0.5 animate-route-pending-in overflow-hidden bg-accent/10 sm:top-16"
      >
        <div className="h-full w-1/3 animate-route-progress bg-accent motion-reduce:animate-none" />
      </div>
    </div>
  )
}
