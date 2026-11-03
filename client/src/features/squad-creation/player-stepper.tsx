import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CONTROL_CLASSES } from './form-field'

export interface PlayerStepperProps {
  /** The id of the label that names the group and the value. */
  labelledBy: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

/** The most digits the value takes: the contract's bounds are both two digits. */
const MAX_DIGITS = 2

/**
 * The buttons paint no ground: the control's border is an inset shadow, and a ground on a button would
 * cover it. A hover only turns the symbol mint, and a button at its bound looks disabled.
 */
const STEP_BUTTON_CLASSES =
  'press focus-visible:outline-text flex w-12.5 shrink-0 items-center justify-center ' +
  'focus-visible:outline-2 focus-visible:-outline-offset-2'

function stepButtonClasses(atBound: boolean): string {
  return cn(
    STEP_BUTTON_CLASSES,
    atBound ? 'text-faint cursor-not-allowed' : 'text-text hover-fine:text-mint'
  )
}

/**
 * The player count as a stepper: − and + around a value the player can type. The text keeps what is
 * typed (digits only, two at most) until it is committed on blur or Enter, when it is clamped to the
 * bounds and written to the form; an empty field restores the last valid value. The arrow keys step by
 * one within the bounds. A separate polite live region announces the count as it changes, so the input
 * is not a live region itself. At a bound a button stays focusable and does nothing (`aria-disabled`),
 * so the keyboard focus does not vanish when the last step is taken.
 */
export function PlayerStepper({ labelledBy, value, min, max, onChange }: PlayerStepperProps) {
  const t = useTranslations('ds.createSquad')
  const [draft, setDraft] = useState(String(value))
  const [shownValue, setShownValue] = useState(value)
  const atMin = value <= min
  const atMax = value >= max

  // The count changed from outside the text (a button, another game): the text follows it.
  if (shownValue !== value) {
    setShownValue(value)
    setDraft(String(value))
  }

  const clamp = (count: number) => Math.min(Math.max(count, min), max)

  const set = (count: number) => {
    setDraft(String(count))
    if (count !== value) onChange(count)
  }

  const commit = () => {
    set(draft === '' ? value : clamp(Number(draft)))
  }

  const stepBy = (delta: number) => {
    const current = draft === '' ? value : Number(draft)
    set(clamp(current + delta))
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Committing the count is not submitting the form or leaving the step.
      event.preventDefault()
      commit()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      stepBy(event.key === 'ArrowUp' ? 1 : -1)
    }
  }

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
          if (!atMin) set(value - 1)
        }}
        className={stepButtonClasses(atMin)}
      >
        <Minus aria-hidden className="size-4" strokeWidth={2.8} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        role="spinbutton"
        autoComplete="off"
        aria-labelledby={labelledBy}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        onFocus={(event) => event.target.select()}
        className="type-counter text-text min-w-0 flex-1 border-0 bg-transparent text-center text-3xl font-black outline-none"
      />
      <span aria-live="polite" className="sr-only">
        {value}
      </span>
      <button
        type="button"
        aria-label={t('playersMore')}
        aria-disabled={atMax}
        onClick={() => {
          if (!atMax) set(value + 1)
        }}
        className={stepButtonClasses(atMax)}
      >
        <Plus aria-hidden className="size-4" strokeWidth={2.8} />
      </button>
    </div>
  )
}
