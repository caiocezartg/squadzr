'use client'

import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { LEGAL_PATHS } from './legal'

/** The links to the Privacy Policy and the Terms of Use, styled by the place that shows them. */
export function LegalLinks({
  linkClassName,
  onNavigate,
}: {
  readonly linkClassName: string
  /** Called when a link is followed, so a drawer can close. */
  readonly onNavigate?: () => void
}) {
  const t = useTranslations('legal.links')

  return (
    <>
      <AppLink href={LEGAL_PATHS.privacy} className={linkClassName} onClick={onNavigate}>
        {t('privacy')}
      </AppLink>
      <AppLink href={LEGAL_PATHS.terms} className={linkClassName} onClick={onNavigate}>
        {t('terms')}
      </AppLink>
    </>
  )
}
