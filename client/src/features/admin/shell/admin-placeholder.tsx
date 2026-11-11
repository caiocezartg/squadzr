import { useTranslations } from 'next-intl'

/** The note of a section whose content a later ticket brings, under the page header. */
export function AdminPlaceholder() {
  const t = useTranslations('admin')

  return (
    <p className="bg-panel text-text-3 px-5 py-4 text-sm font-medium shadow-[inset_0_0_0_1px_var(--color-line)]">
      {t('comingSoon')}
    </p>
  )
}
