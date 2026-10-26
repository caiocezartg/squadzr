import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface StepsProps {
  /** One label per step, e.g. "01 · GAME". */
  steps: readonly string[]
  /** The current step, from 1. */
  current: number
  /** An accessible name for the list, when the page does not already name it. */
  label?: string
  className?: string
}

/** A bar and a label per step: done steps get a check, the current one is marked for assistive technology. */
export function Steps({ steps, current, label, className }: StepsProps) {
  const t = useTranslations('ds.steps')

  return (
    <ol
      aria-label={label}
      className={cn('m-0 grid list-none gap-1.5 p-0', className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const number = index + 1
        const done = number < current
        const active = number === current

        return (
          <li
            key={step}
            aria-current={active ? 'step' : undefined}
            className="flex flex-col gap-[9px]"
          >
            <span aria-hidden className="bg-track block h-[3px] overflow-hidden">
              <span
                className={cn(
                  'bg-mint block h-full origin-left transition-transform duration-[240ms] ease-out',
                  number <= current ? 'scale-x-100' : 'scale-x-0'
                )}
              />
            </span>
            <span
              className={cn(
                'type-label inline-flex items-center gap-[7px] tracking-[0.12em]',
                active ? 'text-text' : done ? 'text-mint' : 'text-faint'
              )}
            >
              {done && <Check aria-hidden className="size-[11px]" strokeWidth={3.4} />}
              {step}
              {done && <span className="sr-only">{t('done')}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
