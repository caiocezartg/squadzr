'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

/**
 * The track's scroll progress, read once from its layout: how far its top has risen past the viewport's
 * top, over the distance it scrolls while pinned. A hidden track (narrow, or reduced motion) has none.
 */
function measureProgress(track: HTMLElement): number | null {
  const travel = track.offsetHeight - window.innerHeight
  if (track.offsetHeight === 0 || travel <= 0) return null
  return Math.min(1, Math.max(0, -track.getBoundingClientRect().top / travel))
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
interface HowItWorksStageProps {
  readonly steps: readonly HowItWorksStep[]
  /**
   * Whether each step's mockup has played. The section keeps it, so a stage that mounts again (the
   * window crossing 1024px, or the motion preference changing) does not play a mockup twice.
   */
  readonly played: readonly boolean[]
  readonly onPlayed: (step: number) => void
}

export function HowItWorksStage({ steps, played, onPlayed }: HowItWorksStageProps) {
  const track = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] })
  const stageInView = useInView(stage, { once: true, amount: FIRST_PLAY_AMOUNT })
  const [active, setActive] = useState(0)

  /** The step at `progress` becomes active, and plays once the track has reached the top. */
  const showProgress = (progress: number) => {
    const step = stepAt(progress)
    setActive(step)
    // At 0 the track has not reached the top yet: the stage may still be below the fold.
    if (progress > 0 && !played[step]) onPlayed(step)
  }

  // motion measures the track on the next frame. A stage that mounts mid-track (a restored scroll, or
  // the window widening past 1024px) reads its progress once before the first paint instead, so it
  // never shows step 01 for a frame. This is a single read at mount, not in the scroll handler.
  useLayoutEffect(() => {
    const progress = track.current ? measureProgress(track.current) : null
    if (progress !== null) showProgress(progress)
    // Only at mount: from then on, the scroll handler below follows the progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useMotionValueEvent(scrollYProgress, 'change', showProgress)

  // Before the track reaches the top, the first step plays once most of the stage is on screen, and
  // only while it is the active step: a stage reached mid-track never plays a step out of sight.
  const playFirstStep = stageInView && active === 0 && !played[0]
  useEffect(() => {
    if (playFirstStep) onPlayed(0)
  }, [playFirstStep, onPlayed])

  return (
    // Shown by CSS from 1024px with motion, so the server HTML already takes the track's height there.
    <div
      ref={track}
      data-layout="sticky"
      className="relative mt-14 hidden h-[300svh] lg:motion-safe:block"
    >
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
          className="relative h-75 w-95 justify-self-center [zoom:1.2] xl:[zoom:1.45]"
        >
          {MOCKUPS.map(({ id, Mockup }, index) => (
            <div
              key={id}
              data-hiw-mockup=""
              data-active={index === active ? '' : undefined}
              data-play={played[index] ? '' : undefined}
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
