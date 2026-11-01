'use client'

import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { Reveal } from '@/components/ui/reveal'
import { columnCovers, DriftingCoverColumn, type CoverWallShape } from './drifting-cover-column'

/** The hero's own covers, so the browser has them already. */
const WALL: CoverWallShape = { columns: 5, coversPerColumn: 3 }
/** Slower than the hero's wall: the banner is a quiet close, not a stage. */
const COLUMN_SECONDS = [150, 126, 168, 138, 156] as const

/**
 * The banner's backdrop: five tilted columns of grey covers drifting in turn up and down. Odd columns
 * sit half a poster lower so the rows interlock.
 */
function CoverDrift() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-37.5 -right-17.5 flex w-175 -rotate-9 items-start gap-3 opacity-20"
    >
      {Array.from({ length: WALL.columns }, (_, index) => (
        <DriftingCoverColumn
          key={index}
          index={index}
          covers={columnCovers(index, WALL)}
          seconds={COLUMN_SECONDS[index % COLUMN_SECONDS.length] ?? 150}
          className={index % 2 === 1 ? 'pt-14' : undefined}
          gapClassName="pb-3"
          imageClassName="grayscale"
          lazy
        />
      ))}
    </div>
  )
}

/**
 * The landing's closing call: a mint banner over drifting covers that sends the visitor to the board.
 * It hangs 64px into the footer, whose top padding leaves room for it.
 */
export function CTABanner() {
  const t = useTranslations('landing.cta')

  return (
    <section className="relative z-10 -mb-16 px-4 pt-16 sm:px-6">
      <div className="bg-mint text-mint-ink relative mx-auto max-w-310 overflow-hidden">
        <CoverDrift />
        <Reveal
          stagger
          className="relative flex flex-wrap items-center justify-between gap-8 px-6 py-12 sm:px-14 sm:py-16"
        >
          <div className="flex max-w-160 flex-col gap-3.5">
            <h2 className="font-display text-[clamp(48px,7.4vw,112px)] leading-[0.96] font-black break-words uppercase">
              {t.rich('title', { em: (chunks) => <em className="block italic">{chunks}</em> })}
            </h2>
            <p className="text-[17px]/[1.55] font-semibold text-[#0B3A27]">{t('subtitle')}</p>
          </div>
          <div>
            <Button
              href="/squads"
              variant="dark"
              size="lg"
              icon={<ArrowRight />}
              iconPosition="end"
            >
              {t('exploreSquads')}
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
