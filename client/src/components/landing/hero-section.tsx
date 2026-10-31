'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { HeroBackdrop } from './hero-backdrop'
import { HeroCodeForm } from './hero-code-form'
import { HeroDemo } from './hero-demo'
import { useDemoGames } from './use-demo-games'
import { useHeroPointer } from './use-hero-pointer'

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
 * The hero, a pre-match screen: what the product is for, in a headline and one sentence, the ways in,
 * and the slot stage that shows it working, lit by the game's art. The headline, copy and actions arrive
 * ready, so the server HTML shows them before any script runs and nothing in them animates in. Only the
 * demo plays. The backdrop and the slots answer the pointer.
 */
export function HeroSection() {
  const t = useTranslations('landing.hero')
  const section = useRef<HTMLElement>(null)
  const demo = useDemoGames()
  useHeroPointer(section)

  return (
    <section
      ref={section}
      id="topo"
      className="relative isolate px-4 pt-6 pb-14 sm:px-6 sm:pt-10 lg:pb-20"
    >
      <HeroBackdrop game={demo.game} games={demo.games} />
      <div className="mx-auto flex max-w-310 flex-col items-center gap-10 text-center sm:gap-14">
        <div className="flex w-full flex-col items-center gap-5">
          <h1 className="font-display text-[clamp(52px,8vw,128px)] leading-[0.92] font-black text-balance uppercase drop-shadow-[0_4px_32px_rgba(0,0,0,0.6)]">
            <span className="block">{t('titleLine1')}</span>{' '}
            <span className="text-mint block drop-shadow-[0_0_28px_rgba(0,255,162,0.35)]">
              {t('titleLine2')}
            </span>
          </h1>
          <p className="text-text-2 max-w-prose text-base/relaxed sm:text-lg/relaxed">
            {t('subtitle')}
          </p>
          <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-3">
            <Button href="/squads" size="lg" icon={<ArrowRight />} iconPosition="end">
              {t('exploreSquads')}
            </Button>
            <Button href="/squads?create=1" variant="secondary" size="lg" icon={<Plus />}>
              {t('createSquad')}
            </Button>
            <HeroCodeForm />
          </div>
          <TrustLine />
        </div>

        <div className="w-full text-left">
          <HeroDemo game={demo.game} games={demo.games} onPick={demo.pick} onIntent={demo.reach} />
        </div>
      </div>
    </section>
  )
}
