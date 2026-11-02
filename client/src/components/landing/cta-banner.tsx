'use client'

import { LayoutGrid } from 'lucide-react'
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
 * The landing's closing call: a compact mint banner over drifting covers, with the hero's call to the
 * board. It sits on the footer's ground and hangs 64px into the footer, whose top padding leaves room
 * for it, so the FAQ, the banner and the footer read as one surface. Below 1024px the call goes under
 * the copy, and below 640px it takes the hero's width.
 */
export function CTABanner() {
  const t = useTranslations('landing.cta')

  return (
    <section className="bg-menu relative z-10 -mb-16 px-4 sm:px-6">
      <div className="bg-mint text-mint-ink relative mx-auto max-w-310 overflow-hidden">
        <CoverDrift />
        <Reveal
          stagger
          className="relative flex flex-col gap-7 px-6 py-9 sm:px-10 sm:py-11 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-12"
        >
          <div className="flex min-w-0 flex-col gap-2.5">
            <h2 className="font-display text-[clamp(36px,3.8vw,56px)] leading-[0.98] font-black text-balance uppercase lg:whitespace-nowrap">
              {t.rich('title', { em: (chunks) => <em className="italic">{chunks}</em> })}
            </h2>
            <p className="max-w-[46ch] text-base/[1.55] font-semibold text-[#0B3A27]">
              {t.rich('subtitle', { line: (chunks) => <span className="block">{chunks}</span> })}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3 max-sm:w-full max-sm:max-w-80 max-sm:flex-col">
            <Button href="/squads" variant="dark" size="lg" icon={<LayoutGrid />}>
              {t('exploreSquads')}
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
