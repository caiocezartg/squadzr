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

const SEPARATOR = ' · '

/**
 * A bar and a label per step: done steps get a check, the current one is marked for assistive technology.
 * When the row is too narrow for the longest label, "02 · DETALHES" with its check, on one line, every label breaks the same way, the
 * number over the name, so no single label wraps alone. The row is the container, not the viewport,
 * because the dialog's width follows the viewport only loosely.
 */
export function Steps({ steps, current, label, className }: StepsProps) {
  const t = useTranslations('ds.steps')

  return (
    <ol
      aria-label={label}
      className={cn('@container m-0 grid list-none gap-1.5 p-0', className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const number = index + 1
        const done = number < current
        const active = number === current
        const [prefix = step, ...rest] = step.split(SEPARATOR)
        const name = rest.join(SEPARATOR)

        return (
          <li
            key={step}
            aria-current={active ? 'step' : undefined}
            className="flex flex-col gap-2.25"
          >
            <span aria-hidden className="bg-track block h-0.75 overflow-hidden">
              <span
                className={cn(
                  'bg-mint block h-full origin-left motion-safe:transition-transform duration-240 ease-out',
                  number <= current ? 'scale-x-100' : 'scale-x-0'
                )}
              />
            </span>
            <span
              className={cn(
                'type-label block tracking-[0.12em]',
                active ? 'text-text' : done ? 'text-mint' : 'text-faint'
              )}
            >
              <span className="inline-flex items-center gap-1.75 @max-[23.5rem]:flex">
                {done && <Check aria-hidden className="size-2.75" strokeWidth={3.4} />}
                {prefix}
              </span>
              {name && <span className="@max-[23.5rem]:hidden">{SEPARATOR}</span>}
              {name && <span className="@max-[23.5rem]:block">{name}</span>}
              {done && <span className="sr-only">{t('done')}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
