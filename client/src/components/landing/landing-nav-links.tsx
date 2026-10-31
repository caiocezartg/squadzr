'use client'

import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { useActiveSection } from './use-active-section'

/** The sections the nav points at, in page order. The scroll-spy follows these. */
const SECTION_IDS = ['jogos', 'como-funciona', 'faq'] as const

/**
 * A game menu entry: mono capitals, a numbered index, and a 2px mint bar under the label that grows
 * from the left on hover, on focus and while the entry is the section in view.
 */
const LINK_CLASSES =
  'font-ds-mono text-text-3 hover-fine:text-text focus-visible:text-text aria-[current=location]:text-text ' +
  'relative inline-flex items-baseline gap-2 text-[12.5px] font-bold tracking-[0.12em] uppercase no-underline ' +
  'transition-colors duration-200 focus-visible:outline-none ' +
  'after:bg-mint after:absolute after:inset-x-0 after:bottom-1.5 after:h-0.5 after:origin-left after:scale-x-0 ' +
  'after:transition-transform after:duration-200 after:ease-out sm:after:-bottom-1.5 ' +
  'hover-fine:after:scale-x-100 focus-visible:after:scale-x-100 aria-[current=location]:after:scale-x-100 ' +
  'max-sm:min-h-11 max-sm:items-center max-sm:self-start'

function Index({ children }: { readonly children: string }) {
  return (
    <span aria-hidden="true" className="text-faint">
      {children}
    </span>
  )
}

/**
 * The landing's in-page navigation: the board, and the sections of the page the nav sits on. The
 * sections are plain anchors, so they scroll without the router. The section in view is marked with
 * `aria-current="location"`; the board is a route, so it never is.
 */
export function LandingNavLinks() {
  const t = useTranslations('landing.nav')
  const active = useActiveSection(SECTION_IDS)
  const current = (id: (typeof SECTION_IDS)[number]) => (active === id ? 'location' : undefined)

  return (
    <nav
      aria-label={t('label')}
      className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2 lg:gap-x-8"
    >
      <AppLink href="/squads" className={LINK_CLASSES}>
        <Index>01</Index>
        {t('explore')}
      </AppLink>
      <a href="#jogos" aria-current={current('jogos')} className={LINK_CLASSES}>
        <Index>02</Index>
        {t('games')}
      </a>
      <a href="#como-funciona" aria-current={current('como-funciona')} className={LINK_CLASSES}>
        <Index>03</Index>
        {t('howItWorks')}
      </a>
      <a href="#faq" aria-current={current('faq')} className={LINK_CLASSES}>
        <Index>04</Index>
        {t('faq')}
      </a>
    </nav>
  )
}
