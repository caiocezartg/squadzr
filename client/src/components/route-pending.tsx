import { useTranslation } from 'react-i18next'

/**
 * Default route loading state, shown by the router while an on-demand route
 * chunk is fetched. It renders as a neutral, invisible placeholder: the empty
 * min-height block keeps the footer from jumping, while the polite status
 * announces loading to assistive technology. CSS-only on purpose: this
 * component ships in the entry chunk, so it must not pull an animation library
 * into the bundle budget.
 */
export function RoutePending() {
  const { t } = useTranslation()

  return (
    <div role="status" aria-live="polite" data-testid="route-pending" className="min-h-[50vh]">
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}
