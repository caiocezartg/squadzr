'use client'

import type { CSSProperties, Ref } from 'react'
import { useTranslations } from 'next-intl'
import { SoloLifeChips } from './solo-life-chips'

/** How far each letter of the struck word drifts from the one before it, in ems. The first stays, so the space before the word holds. */
const DRIFT_STEP = 0.09

/**
 * The word the headline strikes out. Its letters drift apart, then settle dim as the mint strike draws
 * through them; at rest it is already struck, which is how reduced motion shows it. Assistive technology
 * reads the word once, not letter by letter. Below 640px it takes a line of its own.
 */
function StruckWord({ word }: { readonly word: string }) {
  return (
    <span className="max-md:block">
      <span className="text-muted relative inline-flex">
        <span className="sr-only">{word}</span>
        {[...word].map((letter, index) => (
          <span
            // The word never changes, so a letter's place is its identity.
            key={index}
            aria-hidden="true"
            className="motion-safe:animate-hero-solo inline-block opacity-(--struck-dim)"
            style={{ '--drift': `${(index * DRIFT_STEP).toFixed(2)}em` } as CSSProperties}
          >
            {letter}
          </span>
        ))}
        <span
          aria-hidden="true"
          className="bg-mint motion-safe:animate-hero-strike absolute top-1/2 -right-[0.05em] -left-[0.05em] -mt-[0.07em] h-[0.08em] origin-left shadow-[0_0_0.25em_rgba(0,255,162,0.5)] md:-mt-[0.03em]"
        />
      </span>
    </span>
  )
}

/**
 * The hero's headline, in Anton: "stop playing solo", with "solo" struck out, and "build your squad"
 * rising from below its line once the strike is drawn. Below 640px each line takes two. Around it float
 * the signs of the solo life, which take the headline's size so their spots hold at any width. At rest
 * it is the end of the story, so the server HTML and reduced motion show it complete.
 */
export function HeroHeadline({ ref }: { readonly ref: Ref<HTMLHeadingElement> }) {
  const t = useTranslations('landing.hero')

  return (
    <div className="relative w-full text-[min(15.5cqw,72px)] md:text-[clamp(64px,7.2vw,112px)]">
      <h1
        ref={ref}
        className="font-hero leading-[1.06] tracking-[0.004em] uppercase [--struck-dim:0.55] md:leading-[0.96] md:[--struck-dim:0.3]"
      >
        <span className="block">
          {t('titleLead')} <StruckWord word={t('titleStruck')} />
        </span>{' '}
        {/* The second line rises inside a clip that leaves room for accents above and the Q's tail below. */}
        <span className="-mt-[0.24em] -mb-[0.12em] block overflow-y-clip pt-[0.24em] pb-[0.12em]">
          <span className="motion-safe:animate-hero-rise block">
            {t('titleLine2Lead')}{' '}
            <span className="text-mint max-md:block">{t('titleLine2Word')}</span>
          </span>
        </span>
      </h1>
      <SoloLifeChips />
    </div>
  )
}
