'use client'

import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'

const LINK_CLASSES =
  'text-text-3 hover-fine:text-text focus-visible:outline-mint text-sm font-semibold no-underline transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 max-sm:flex max-sm:min-h-11 max-sm:items-center'

/**
 * The landing's in-page navigation: the board, and the sections of the page the nav sits on. The
 * sections are plain anchors, so they scroll without the router.
 */
export function LandingNavLinks() {
  const t = useTranslations('landing.nav')

  return (
    <nav
      aria-label={t('label')}
      className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-7 sm:gap-y-2"
    >
      <AppLink href="/squads" className={LINK_CLASSES}>
        {t('explore')}
      </AppLink>
      <a href="#jogos" className={LINK_CLASSES}>
        {t('games')}
      </a>
      <a href="#como-funciona" className={LINK_CLASSES}>
        {t('howItWorks')}
      </a>
      <a href="#faq" className={LINK_CLASSES}>
        {t('faq')}
      </a>
    </nav>
  )
}
