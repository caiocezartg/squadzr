'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { DiscordNotAffiliated } from '@/components/legal/discord-notices'
import { LegalLinks } from '@/components/legal/legal-links'
import { AppLink } from '@/components/layout/app-link'
import { useClock } from '@/hooks/use-clock'

const LINK_CLASSES =
  'text-text-2 hover-fine:text-text focus-visible:outline-mint text-sm no-underline transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4'

function FooterColumn({
  title,
  children,
}: {
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="type-label text-muted">{title}</span>
      {children}
    </div>
  )
}

/**
 * The landing's own footer (the shell's stays off `/`): the logo and tagline, the product and help
 * links, the legal links, the large outlined wordmark, the notice that Squadzr is not Discord, and
 * the IGDB credit. Its in-page links name the landing, so they also work from the legal pages, which
 * share it. It has no motion, so it renders in the server HTML. The year comes from the shared clock, which starts at the server's request time, so
 * the server and the first client render agree; it is read in UTC so both sides name the same year
 * whatever their time zones.
 */
export function LandingFooter() {
  const t = useTranslations('landing.footer')
  const year = useClock().getUTCFullYear()

  return (
    <footer className="bg-menu px-4 pt-24 pb-10 sm:px-6 sm:pt-34">
      <div className="mx-auto flex max-w-310 flex-col gap-14">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="flex max-w-85 flex-1 basis-70 flex-col gap-4">
            <img src="/squadzr-logo.svg" alt="Squadzr" className="block w-32" />
            <p className="text-text-3 text-sm/[1.6]">{t('tagline')}</p>
          </div>
          <nav aria-label={t('label')} className="flex flex-wrap gap-x-14 gap-y-10">
            <FooterColumn title={t('product')}>
              <AppLink href="/squads" className={LINK_CLASSES}>
                {t('exploreSquads')}
              </AppLink>
              <AppLink href="/squads?create=1" className={LINK_CLASSES}>
                {t('createSquad')}
              </AppLink>
            </FooterColumn>
            <FooterColumn title={t('help')}>
              <a href="/#como-funciona" className={LINK_CLASSES}>
                {t('howItWorks')}
              </a>
              <a href="/#faq" className={LINK_CLASSES}>
                {t('faq')}
              </a>
              <a href="/#jogos" className={LINK_CLASSES}>
                {t('games')}
              </a>
            </FooterColumn>
            <FooterColumn title={t('legal')}>
              <LegalLinks linkClassName={LINK_CLASSES} />
            </FooterColumn>
          </nav>
        </div>

        <div
          aria-hidden="true"
          className="font-display overflow-x-clip text-[clamp(48px,23.5vw,340px)] leading-[0.78] font-black whitespace-nowrap text-transparent uppercase [-webkit-text-stroke:1.5px_var(--color-line)]"
        >
          Squadzr
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-5.5 shadow-[inset_0_1px_0_var(--color-raised-2)]">
          <div className="flex flex-col gap-1.5">
            <span className="text-muted text-[13px]">{t('copyright', { year })}</span>
            <DiscordNotAffiliated />
          </div>
          <a
            href="https://www.igdb.com"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-muted hover-fine:text-text-2 focus-visible:outline-mint text-[11px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {t('gameDataByIgdb')}
          </a>
        </div>
      </div>
    </footer>
  )
}
