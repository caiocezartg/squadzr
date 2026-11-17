'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { LayoutGrid, Plus } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { HeroCoverWall } from './hero-cover-wall'
import { HeroHeadline } from './hero-headline'
import { HeroSquadRail } from './hero-squad-rail'
import { SQUADMATES } from './hero-solo-data'
import { heroClock } from './hero-timeline'

/** Quiet product facts: small and muted, with a dot between them. */
function TrustLine() {
  const t = useTranslations('landing.hero')
  const items = [t('trustDiscord'), t('trustPlayers'), t('trustFree')]

  return (
    <ul className="text-muted mt-4.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[13px] font-semibold">
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
 * The hero, over a wall of game covers kept almost out of sight, takes the first screen. It tells one
 * story, once: the visitor alone in a lobby, with the solo life floating around the headline, until
 * "solo" is struck out, "build your squad" rises, and four players fly into the visitor's squad. Then
 * one sentence and the two ways in. The story runs on CSS from the first paint; at rest, which is what
 * the server HTML and reduced motion show, the squad is complete.
 */
export function HeroSection() {
  const t = useTranslations('landing.hero')
  const headline = useRef<HTMLHeadingElement>(null)

  return (
    <section
      id="topo"
      className="relative isolate flex min-h-[calc(100svh-4.25rem)] flex-col justify-center overflow-x-clip px-4 pt-24 pb-16 sm:px-6 sm:pt-28 lg:pb-24"
      style={heroClock(SQUADMATES.length)}
    >
      <HeroCoverWall />
      <div className="@container mx-auto flex w-full max-w-310 flex-col items-center text-center">
        <HeroHeadline ref={headline} />
        <div className="mt-6 sm:mt-7.5">
          <HeroSquadRail headline={headline} />
        </div>
        <p className="text-text-2 mt-5 max-w-[40ch] text-lg/snug font-medium text-balance sm:mt-6.5 sm:text-xl/snug">
          {t.rich('subtitle', {
            strong: (chunks) => <strong className="text-text font-extrabold">{chunks}</strong>,
          })}
        </p>
        {/* The calls take the sidebar's icons, before the label. Below 640px they stack, one width for both. */}
        <div className="mt-6 flex w-full flex-wrap items-center justify-center gap-3 max-sm:max-w-80 max-sm:flex-col max-sm:items-stretch sm:mt-7.5">
          <Button href="/squads" size="lg" icon={<LayoutGrid />}>
            {t('exploreSquads')}
          </Button>
          <Button href="/squads?create=1" variant="secondary" size="lg" icon={<Plus />}>
            {t('createSquad')}
          </Button>
        </div>
        <TrustLine />
      </div>
    </section>
  )
}
