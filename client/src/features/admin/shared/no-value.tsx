'use client'

import { useTranslations } from 'next-intl'

/** A missing value: a dash on screen, a word for a screen reader. */
export function NoValue() {
  const t = useTranslations('admin.audit')

  return (
    <>
      <span aria-hidden="true" className="text-faint">
        —
      </span>
      <span className="sr-only">{t('none')}</span>
    </>
  )
}
