import { cn } from '@/lib/utils'

/** One step of "Como funciona", as the messages carry it. */
export interface HowItWorksStep {
  readonly title: string
  readonly description: string
}

interface StepNumeralProps {
  /** The step's place, from 0. */
  readonly index: number
  /** Filled mint; otherwise outlined. */
  readonly lit: boolean
  /** The numeral's size. */
  readonly className: string
}

/**
 * The step's big numeral (01–03): an outline, with the mint fill laid over it that fades in when the
 * step lights up, so the change is an opacity transition and never a repaint of the text. Decorative:
 * the list already numbers the steps.
 */
export function StepNumeral({ index, lit, className }: StepNumeralProps) {
  const label = String(index + 1).padStart(2, '0')

  return (
    <span
      aria-hidden="true"
      // The size goes first: tailwind-merge drops a line height that comes before a font size.
      className={cn(
        className,
        'font-display relative block leading-[0.78] font-black tracking-[-0.01em]'
      )}
    >
      <span className="block text-transparent [-webkit-text-stroke:2px_rgba(255,255,255,0.16)]">
        {label}
      </span>
      <span
        data-lit={lit ? '' : undefined}
        className="text-mint absolute inset-0 opacity-0 transition-opacity duration-300 ease-(--ease-out) [-webkit-text-stroke:2px_var(--color-mint)] data-lit:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

/** The step's title and description. */
export function StepCopy({ step }: { readonly step: HowItWorksStep }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-text text-[30px] leading-none font-extrabold uppercase">
        {step.title}
      </h3>
      <p className="text-text-3 text-[15px]/[1.6]">{step.description}</p>
    </div>
  )
}
