'use client'

import * as m from 'motion/react-m'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { SlotMeter } from '@/components/ds/slot-meter'
import { Tag } from '@/components/ds/tag'
import { cn } from '@/lib/utils'
import { DEMO_SQUAD } from './hero-demo-data'
import { HeroDemoInvite } from './hero-demo-invite'
import { HeroDemoMembers } from './hero-demo-members'
import { HeroDemoToasts } from './hero-demo-toasts'
import { DEMO_TOTAL, useHeroDemo } from './use-hero-demo'

/** The squad's count. A new digit fades in over 150ms once the script is playing, like the Lobby's. */
function DemoCounter({
  filled,
  scripted,
}: {
  readonly filled: number
  readonly scripted: boolean
}) {
  const complete = filled === DEMO_TOTAL

  return (
    <p className="font-display text-[26px] leading-none font-extrabold tabular-nums">
      <m.span
        key={filled}
        className={complete ? 'text-mint' : 'text-text'}
        initial={scripted ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {filled}
      </m.span>
      <span className={complete ? 'text-mint' : 'text-faint'}>/{DEMO_TOTAL}</span>
    </p>
  )
}

/**
 * The hero's demo card: a Valorant squad filling up to 5/5 and unlocking its Discord invite. The
 * server HTML and the first render show it full; after that `useHeroDemo` plays the story once when
 * the card is visible. The whole card is one illustration to assistive technology, described in its
 * final state, so nothing in it announces a ticking counter.
 */
export function HeroDemoCard() {
  const t = useTranslations('landing.demo')
  const cardRef = useRef<HTMLDivElement>(null)
  const demo = useHeroDemo(cardRef)
  const complete = demo.filled === DEMO_TOTAL

  return (
    <div className="relative py-6">
      <span
        aria-hidden="true"
        className="border-mint/60 absolute top-1.5 -left-3.5 hidden size-6.5 border-t-2 border-l-2 sm:block"
      />
      <span
        aria-hidden="true"
        className="border-mint/60 absolute right-0 bottom-1.5 hidden size-6.5 border-r-2 border-b-2 sm:block lg:-right-3.5"
      />

      <div
        role="img"
        aria-label={t('label', { name: DEMO_SQUAD.name })}
        data-instant={demo.instant ? '' : undefined}
        className="flex flex-col gap-3.5 data-instant:[&_*]:transition-none"
      >
        <div
          ref={cardRef}
          className="bg-card relative grid shadow-[0_0_0_1px_rgba(255,255,255,0.06)] sm:grid-cols-[160px_minmax(0,1fr)] lg:grid-cols-[140px_minmax(0,1fr)] xl:grid-cols-[196px_minmax(0,1fr)]"
        >
          <span
            aria-hidden="true"
            data-complete={complete ? '' : undefined}
            className={cn(
              'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out',
              'shadow-[0_0_0_1px_rgba(0,255,162,0.55),0_30px_80px_-30px_rgba(0,255,162,0.55)] data-complete:opacity-100'
            )}
          />
          <div className="relative min-h-40 sm:min-h-65.5">
            {/* A plain image, as every IGDB cover is: the poster only decorates the card. */}
            <img
              src={DEMO_SQUAD.coverUrl}
              alt=""
              className="absolute inset-0 size-full object-cover object-top"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-3.5 px-4 py-5 sm:px-6 sm:py-5.5 lg:px-4 xl:px-5">
            <div className="flex items-center justify-between gap-2.5">
              <span className="font-ds-mono text-text text-xs font-bold tracking-[0.14em]">
                {DEMO_SQUAD.game}
              </span>
              <span className="font-ds-mono text-faint text-xs">{DEMO_SQUAD.code}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-display text-4xl leading-[1.08] font-extrabold">
                {DEMO_SQUAD.name}
              </span>
              <span className="text-text-3 flex flex-wrap items-center gap-2 text-[12.5px]">
                <Tag variant="lang" label={DEMO_SQUAD.language} />
                {DEMO_SQUAD.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </span>
            </div>
            <div className="grow" />
            <div className="bg-raised flex flex-col gap-3 px-3 py-3.5 sm:px-4 lg:px-3">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <SlotMeter variant="line" filled={demo.filled} total={DEMO_TOTAL} />
                </div>
                <DemoCounter filled={demo.filled} scripted={demo.scripted} />
              </div>
              <HeroDemoMembers filled={demo.filled} scripted={demo.scripted} />
            </div>
          </div>
        </div>
        <HeroDemoInvite unlocked={complete} />
      </div>

      <HeroDemoToasts visible={demo.toasts} />
    </div>
  )
}
