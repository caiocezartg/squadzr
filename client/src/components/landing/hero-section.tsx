'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { HeroCodeForm } from './hero-code-form'
import { HeroDemoCard } from './hero-demo-card'

/** The "N GAMES · SQUADS OPEN NOW" badge. The count is the catalog's total, so 0 means no badge. */
function GamesBadge({ count }: { readonly count: number }) {
  const t = useTranslations('landing.hero')

  if (count === 0) return null

  return (
    <span className="bg-card text-text-2 font-ds-mono inline-flex items-center gap-2.5 self-start py-2.25 pr-3.5 pl-3 text-xs font-bold tracking-[0.08em]">
      <span
        aria-hidden="true"
        className="bg-mint size-2 motion-safe:animate-live rounded-full shadow-[0_0_10px_var(--color-mint)]"
      />
      {t('badge', { count })}
    </span>
  )
}

function TrustLine() {
  const t = useTranslations('landing.hero')
  const items = [t('trustDiscord'), t('trustPlayers'), t('trustFree')]

  return (
    <ul className="font-ds-mono text-ds-muted flex flex-wrap gap-x-5.5 gap-y-2 text-[11.5px] font-bold tracking-[0.08em]">
      {items.map((item) => (
        <li key={item} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="bg-mint size-1.25" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * The hero. Its badge, headline, copy and calls to action arrive ready, so the server HTML shows them
 * before any script runs and nothing in them animates in. Only the demo card plays, once.
 */
export function HeroSection({ gameCount }: { readonly gameCount: number }) {
  const t = useTranslations('landing.hero')

  return (
    <section id="topo" className="relative overflow-x-clip px-4 pt-12 pb-24 sm:px-6 lg:pb-30">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-size-[64px_64px]"
      />
      <div
        aria-hidden="true"
        className="from-bg pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-linear-to-t to-transparent"
      />

      <div className="relative mx-auto flex max-w-310 flex-col items-stretch gap-12 lg:flex-row lg:items-center lg:gap-10 xl:gap-16">
        <div className="flex min-w-0 flex-col gap-7 lg:w-[min(41.5vw,660px)] lg:flex-none">
          <GamesBadge count={gameCount} />
          <h1 className="type-display tracking-[-0.005em] wrap-break-word">
            {t('titleLine1')} <br />
            <span className="text-mint">{t('titleAccent')}</span>
          </h1>
          <p className="text-text-3 max-w-125 text-lg/[1.6]">
            {t.rich('subtitle', {
              bold: (chunks) => <strong className="text-text">{chunks}</strong>,
            })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/squads" size="lg" icon={<ArrowRight />} iconPosition="end">
              {t('exploreSquads')}
            </Button>
            <Button href="/squads?create=1" variant="secondary" size="lg" icon={<Plus />}>
              {t('createSquad')}
            </Button>
          </div>
          <HeroCodeForm />
          <TrustLine />
        </div>

        <div className="min-w-0 lg:flex-1">
          <HeroDemoCard />
        </div>
      </div>
    </section>
  )
}
