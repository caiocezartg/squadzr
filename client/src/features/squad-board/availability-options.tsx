import { useTranslations } from 'next-intl'
import { SlotMeter } from '@/components/ds/slot-meter'
import type { SquadStatusFilter } from '@/features/squad-list'
import { cn } from '@/lib/utils'

type Availability = SquadStatusFilter

/** Filled pips of a five-pip meter: all is full, with space is mostly open, almost full is nearly full. */
const OPTIONS: readonly { value: Availability; pips: number }[] = [
  { value: 'all', pips: 5 },
  { value: 'has-space', pips: 2 },
  { value: 'almost-full', pips: 4 },
]

const LABEL_KEYS = {
  all: 'ds.board.availabilityAll',
  'has-space': 'ds.board.availabilityHasSpace',
  'almost-full': 'ds.board.availabilityAlmostFull',
} as const

/** The message of an availability option, which the filter chips share with the panel. */
export function availabilityLabelKey(value: Availability) {
  return LABEL_KEYS[value]
}

interface AvailabilityOptionsProps {
  readonly value: string
  readonly onChange: (value: Availability) => void
}

/** The availability choices as three pressable cards, each with a pip meter showing how full it means. */
export function AvailabilityOptions({ value, onChange }: AvailabilityOptionsProps) {
  const t = useTranslations()

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="type-label text-ds-muted mb-2.5 p-0">{t('ds.board.availability')}</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((option) => {
          const pressed = option.value === value

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange(option.value)}
              className={cn(
                'press focus-visible:outline-text flex min-h-11 flex-col items-start gap-2.5 p-3 text-left text-[12.5px] font-bold focus-visible:outline-2 focus-visible:-outline-offset-2',
                pressed
                  ? 'bg-mint/10 text-mint shadow-[inset_0_0_0_2px_var(--color-mint)]'
                  : 'bg-panel text-text-3 hover-fine:text-text'
              )}
            >
              <SlotMeter variant="pips" filled={option.pips} total={5} />
              {t(LABEL_KEYS[option.value])}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
