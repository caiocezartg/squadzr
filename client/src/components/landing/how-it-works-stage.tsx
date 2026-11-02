'use client'

import { useRef, useState } from 'react'
import {
  useInView,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import * as m from 'motion/react-m'
import { MOCKUPS } from './how-it-works-mockups'
import { StepCopy, StepNumeral, type HowItWorksStep } from './how-it-works-step'

/** The steps, and the thirds of the track each one owns. */
const STEP_COUNT = MOCKUPS.length

/** The step a scroll progress through the track (0–1) falls in: the track is split in thirds. */
export function stepAt(progress: number): number {
  return Math.min(STEP_COUNT - 1, Math.max(0, Math.floor(progress * STEP_COUNT)))
}

/** How far through its own third the track's progress is, from 0 to 1. */
function stepProgress(progress: number, index: number): number {
  return Math.min(1, Math.max(0, progress * STEP_COUNT - index))
}

/** The 2px bar under a step's numeral, filling linearly with the step's third of the track. */
function StepBar({
  progress,
  index,
}: {
  readonly progress: MotionValue<number>
  readonly index: number
}) {
  // A full transform string, so the browser composites the fill instead of repainting it.
  const transform = useTransform(progress, (value) => `scaleX(${stepProgress(value, index)})`)

  return (
    <span aria-hidden="true" className="bg-line block h-0.5 overflow-hidden">
      <m.span className="bg-mint block h-full origin-left" style={{ transform }} />
    </span>
  )
}

/** How much of the stage must be on screen before the first step's mockup plays. */
const FIRST_PLAY_AMOUNT = 0.75

/**
 * "Como funciona" at wide widths with motion (reference, Motion: "Como funciona"). A track three
 * viewports tall holds a sticky stage: the steps on the left and the active step's mockup on the
 * right. The scroll through the track picks the active step in thirds; its numeral fills mint, the
 * bar under each numeral fills with its third, and the mockups crossfade. Each mockup plays its
 * micro-animation once, the first time its step is active on screen. Once the third step completes,
 * the track ends and the stage scrolls away with the page.
 *
 * The scroll handler only sets state from the progress motion already measured; it reads no layout.
 * Every step's copy stays in the list at every scroll position: an inactive step is dimmed, never
 * hidden.
 */
export function HowItWorksStage({ steps }: { readonly steps: readonly HowItWorksStep[] }) {
  const track = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] })
  const stageInView = useInView(stage, { once: true, amount: FIRST_PLAY_AMOUNT })
  const [active, setActive] = useState(0)
  // One bit per step whose mockup has played. The first step also plays once the stage is in view.
  const [played, setPlayed] = useState(0)

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const step = stepAt(progress)
    setActive(step)
    // At 0 the track has not reached the top yet: the stage may still be below the fold.
    if (progress > 0) setPlayed((mask) => mask | (1 << step))
  })

  const hasPlayed = (index: number) => (played & (1 << index)) !== 0 || (index === 0 && stageInView)

  return (
    <div ref={track} data-layout="sticky" className="relative mt-14 h-[300svh]">
      <div
        ref={stage}
        className="sticky top-0 grid h-svh grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-16 pt-17"
      >
        <ol className="flex flex-col gap-10">
          {steps.map((step, index) => (
            <li
              key={step.title}
              data-active={index === active ? '' : undefined}
              className="group grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-x-7"
            >
              <span aria-hidden="true" className="flex flex-col gap-3">
                <StepNumeral index={index} lit={index === active} className="text-[104px]" />
                <StepBar progress={scrollYProgress} index={index} />
              </span>
              <div className="opacity-45 transition-opacity duration-300 ease-(--ease-out) group-data-active:opacity-100">
                <StepCopy step={step} />
              </div>
            </li>
          ))}
        </ol>

        <div
          aria-hidden="true"
          className="relative h-75 w-95 justify-self-center lg:[zoom:1.2] xl:[zoom:1.45]"
        >
          {MOCKUPS.map(({ id, Mockup }, index) => (
            <div
              key={id}
              data-hiw-mockup=""
              data-active={index === active ? '' : undefined}
              data-play={hasPlayed(index) ? '' : undefined}
              className="absolute inset-0 opacity-0 blur-[2px] transition-[opacity,filter] duration-300 ease-(--ease-out) data-active:opacity-100 data-active:blur-none"
            >
              <Mockup />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
