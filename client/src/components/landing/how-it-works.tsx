'use client'

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
 * and its copy, revealed with the section. Below 1024px, under reduced motion at any width, and in
 * the server HTML, which cannot know the width.
 */
function HowItWorksCards({ steps }: { readonly steps: readonly HowItWorksStep[] }) {
  return (
    <Reveal
      as="ol"
      stagger
      data-layout="stacked"
      className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-6"
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
              <div aria-hidden="true" className="h-52.5">
                <Mockup />
              </div>
            )}
            <StepCopy step={step} />
          </li>
        )
      })}
    </Reveal>
  )
}

/**
 * The landing's "Como funciona" (reference, Motion: "Como funciona"): the three steps from signing in
 * with Discord to a full team. At wide widths with motion they advance in a sticky stage as the
 * visitor scrolls; otherwise they are stacked cards. The server renders the cards, and a wide screen
 * swaps them for the stage once it hydrates, while the section is still below the fold.
 */
export function HowItWorks() {
  const t = useTranslations('landing.howItWorks')
  const steps = t.raw('steps') as readonly HowItWorksStep[]
  const wide = useMediaQuery(WIDE_QUERY)
  const reducedMotion = useReducedMotion()

  return (
    <section id="como-funciona" className="scroll-mt-20 px-4 py-24 sm:px-6 sm:py-30">
      <div className="mx-auto max-w-310">
        <Reveal stagger className="flex max-w-180 flex-col gap-3.5">
          <SectionEyebrow>{t('label')}</SectionEyebrow>
          <h2 className="type-section-title text-balance">{t('title')}</h2>
        </Reveal>
        {wide && !reducedMotion ? (
          <HowItWorksStage steps={steps} />
        ) : (
          <HowItWorksCards steps={steps} />
        )}
      </div>
    </section>
  )
}
