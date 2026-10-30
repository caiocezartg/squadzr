import { Minus, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CONTROL_CLASSES } from './form-field'

export interface PlayerStepperProps {
  /** The id of the label that names the group. */
  labelledBy: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

const STEP_BUTTON_CLASSES =
  'press focus-visible:outline-text flex w-12.5 shrink-0 items-center justify-center ' +
  'focus-visible:outline-2 focus-visible:-outline-offset-2'

/** A button at its bound looks disabled and has no hover. */
function stepButtonClasses(atBound: boolean): string {
  return cn(
    STEP_BUTTON_CLASSES,
    atBound ? 'text-faint cursor-not-allowed' : 'text-text hover-fine:bg-raised'
  )
}

/**
 * The player count as a stepper: − and + around the value, which a polite live region announces as it
 * changes. At a bound the button stays focusable and does nothing (`aria-disabled`), so the keyboard
 * focus does not vanish when the last step is taken.
 */
export function PlayerStepper({ labelledBy, value, min, max, onChange }: PlayerStepperProps) {
  const t = useTranslations('ds.createSquad')
  const atMin = value <= min
  const atMax = value >= max

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn('flex min-h-12.5 items-stretch', CONTROL_CLASSES)}
    >
      <button
        type="button"
        aria-label={t('playersFewer')}
        aria-disabled={atMin}
        onClick={() => {
          if (!atMin) onChange(value - 1)
        }}
        className={stepButtonClasses(atMin)}
      >
        <Minus aria-hidden className="size-4" strokeWidth={2.8} />
      </button>
      <span
        aria-live="polite"
        className="type-counter flex flex-1 items-center justify-center text-3xl font-black"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={t('playersMore')}
        aria-disabled={atMax}
        onClick={() => {
          if (!atMax) onChange(value + 1)
        }}
        className={stepButtonClasses(atMax)}
      >
        <Plus aria-hidden className="size-4" strokeWidth={2.8} />
      </button>
    </div>
  )
}
