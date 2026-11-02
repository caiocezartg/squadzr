'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { useMediaQuery } from '@/components/ds/use-media-query'
import { WIDE_QUERY } from '@/components/layout/wide-query'
import { Reveal } from '@/components/ui/reveal'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { MOCKUPS } from './how-it-works-mockups'
import { HowItWorksStage } from './how-it-works-stage'
import { StepCopy, StepNumeral, type HowItWorksStep } from './how-it-works-step'
import { SectionEyebrow } from './section-eyebrow'

/**
 * "Como funciona" as three stacked cards, each step with its numeral, its mockup in its final state
 * and its copy, revealed with the section. Below 1024px and under reduced motion at any width; CSS
 * hides them otherwise, which is what the server HTML relies on.
 */
function HowItWorksCards({ steps }: { readonly steps: readonly HowItWorksStep[] }) {
  return (
    <Reveal
      as="ol"
      stagger
      data-layout="stacked"
      className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-6 lg:motion-safe:hidden"
    >
      {steps.map((step, index) => {
        const Mockup = MOCKUPS[index]?.Mockup
        return (
          <li key={step.title} className="flex min-w-0 flex-col gap-5.5">
            <span aria-hidden="true" className="flex flex-col gap-3.5">
              <StepNumeral index={index} lit className="text-[120px] sm:text-[176px]" />
              <span className="bg-mint block h-0.5" />
            </span>
            {Mockup && (
              <div aria-hidden="true" className="h-75 w-full max-w-105">
                <Mockup mode="final" />
              </div>
            )}
            <StepCopy step={step} />
          </li>
        )
      })}
    </Reveal>
  )
}

function subscribeToNothing(): () => void {
  return () => undefined
}

/** False in the server render and while hydrating, true once the client renders on its own. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  )
}

/**
 * The landing's "Como funciona" (reference, Motion: "Como funciona"): the three steps from signing in
 * with Discord to a full team. At wide widths with motion they advance in a sticky stage as the
 * visitor scrolls; otherwise they are stacked cards.
 *
 * The server cannot know the width or the motion preference, so its HTML carries both layouts and CSS
 * shows the one that fits. The page then has its final height before any script runs, and a link to a
 * section below this one lands in place. Once hydrated, only the layout that fits stays mounted. A
 * window that later crosses 1024px swaps the layout, and the section's height with it, as any
 * responsive layout does; the mockups that have played stay played.
 */
export function HowItWorks() {
  const t = useTranslations('landing.howItWorks')
  const steps = t.raw('steps') as readonly HowItWorksStep[]
  const wide = useMediaQuery(WIDE_QUERY)
  const reducedMotion = useReducedMotion()
  const hydrated = useHydrated()
  const staged = wide && !reducedMotion
  // Whether each step's mockup has played in the stage. It lives here, above the stage, so it outlasts
  // a stage that unmounts and mounts again.
  const [played, setPlayed] = useState<readonly boolean[]>(() => MOCKUPS.map(() => false))
  const markPlayed = useCallback((step: number) => {
    setPlayed((current) =>
      current[step] ? current : current.map((done, index) => done || index === step)
    )
  }, [])

  return (
    <section id="como-funciona" className="scroll-mt-20 px-4 py-24 sm:px-6 sm:py-30">
      <div className="mx-auto max-w-310">
        <Reveal stagger className="flex max-w-180 flex-col gap-3.5">
          <SectionEyebrow>{t('label')}</SectionEyebrow>
          <h2 className="type-section-title text-balance">{t('title')}</h2>
        </Reveal>
        {(!hydrated || staged) && (
          <HowItWorksStage steps={steps} played={played} onPlayed={markPlayed} />
        )}
        {(!hydrated || !staged) && <HowItWorksCards steps={steps} />}
      </div>
    </section>
  )
}
