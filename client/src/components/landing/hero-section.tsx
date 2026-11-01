'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { HeroCoverWall } from './hero-cover-wall'
import { HeroSquadShowcase } from './hero-squad-showcase'

/** Quiet product facts: small and muted, with a dot between them. */
function TrustLine() {
  const t = useTranslations('landing.hero')
  const items = [t('trustDiscord'), t('trustPlayers'), t('trustFree')]

  return (
    <ul className="text-ds-muted flex flex-wrap justify-center gap-x-3 gap-y-1 text-[13px] font-semibold">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3">
          {index > 0 && <span aria-hidden="true">·</span>}
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * The hero: what the product is for, in a headline and one sentence, the two ways in, and a carousel of
 * squads filling up that shows it working, over a wall of game covers kept almost out of sight. The
 * headline, copy and actions arrive ready, so the server HTML shows them before any script runs and
 * nothing in them animates in. Only the backdrop and the carousel move.
 */
export function HeroSection() {
  const t = useTranslations('landing.hero')

  return (
    <section id="topo" className="relative isolate px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:pb-24">
      <HeroCoverWall />
      <div className="mx-auto flex max-w-310 flex-col items-center gap-10 text-center sm:gap-12">
        <div className="flex w-full flex-col items-center gap-5 sm:gap-6">
          <h1 className="font-display text-[clamp(52px,7.5vw,112px)] leading-[0.92] font-black text-balance uppercase drop-shadow-[0_4px_32px_rgba(0,0,0,0.6)]">
            <span className="block">{t('titleLine1')}</span>{' '}
            <span className="text-mint block drop-shadow-[0_0_28px_rgba(0,255,162,0.35)]">
              {t('titleLine2')}
            </span>
          </h1>
          <p className="text-text-2 max-w-[34ch] text-lg/snug font-medium text-balance sm:text-xl/snug">
            {t('subtitle')}
          </p>
          <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-3">
            <Button href="/squads" size="lg" icon={<ArrowRight />} iconPosition="end">
              {t('exploreSquads')}
            </Button>
            <Button href="/squads?create=1" variant="secondary" size="lg" icon={<Plus />}>
              {t('createSquad')}
            </Button>
          </div>
          <TrustLine />
        </div>

        <HeroSquadShowcase />
      </div>
    </section>
  )
}
