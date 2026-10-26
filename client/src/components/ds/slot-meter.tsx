import { cn } from '@/lib/utils'

export type SlotMeterVariant = 'blocks' | 'line' | 'pips'
export type SlotMeterTone = 'mint' | 'discord' | 'amber'

/** A squad of more than this many slots draws this many segments, each standing for several slots. */
const MAX_SEGMENTS = 10

/** The lit colour, which the segments take from the meter's `currentColor`. */
const TONE_CLASSES: Record<SlotMeterTone, string> = {
  mint: 'text-mint',
  discord: 'text-discord-soft',
  amber: 'text-amber',
}

const VARIANT_CLASSES: Record<SlotMeterVariant, { meter: string; segment: string }> = {
  blocks: { meter: 'gap-1', segment: 'h-2' },
  line: { meter: 'w-full gap-0.5', segment: 'h-1 flex-1' },
  pips: { meter: 'gap-0.5', segment: 'h-1.25 w-2.5' },
}

interface SlotMeterProps {
  readonly filled: number
  readonly total: number
  /** @default 'blocks' */
  readonly variant?: SlotMeterVariant
  /** @default 'mint' */
  readonly tone?: SlotMeterTone
}

/**
 * The Redesign v2 slot meter (reference, Components). It is decorative to assistive technology:
 * the parent supplies the count as text.
 */
export function SlotMeter({ filled, total, variant = 'blocks', tone = 'mint' }: SlotMeterProps) {
  const slots = Math.max(1, total)
  const segments = Math.min(slots, MAX_SEGMENTS)
  const lit = Math.round((Math.min(slots, Math.max(0, filled)) / slots) * segments)
  const classes = VARIANT_CLASSES[variant]

  return (
    <span aria-hidden="true" className={cn('flex', classes.meter, TONE_CLASSES[tone])}>
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          data-filled={index < lit ? '' : undefined}
          className={cn(
            'bg-track transition-colors duration-200 data-filled:bg-current',
            classes.segment,
            variant === 'blocks' && (slots > 5 ? 'w-4.5' : 'w-10')
          )}
        />
      ))}
    </span>
  )
}
