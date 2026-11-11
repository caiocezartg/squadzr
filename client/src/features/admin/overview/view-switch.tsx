'use client'

import { ChartLine, Table } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export type ActivityView = 'chart' | 'table'

const VIEWS = [
  { view: 'chart', Icon: ChartLine },
  { view: 'table', Icon: Table },
] as const

interface ViewSwitchProps {
  readonly value: ActivityView
  readonly onChange: (view: ActivityView) => void
}

/**
 * The Activity panel's view: the chart or the table of the days, as two icon toggle buttons in a
 * hairline box, styled like the period switch, the pressed one raised over a mint underline.
 */
export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  const t = useTranslations('admin.overview.activity.view')

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex shrink-0 shadow-[inset_0_0_0_1px_var(--color-line)]"
    >
      {VIEWS.map(({ view, Icon }) => {
        const pressed = view === value

        return (
          <button
            key={view}
            type="button"
            aria-pressed={pressed}
            aria-label={t(view)}
            title={t(view)}
            onClick={() => onChange(view)}
            className={cn(
              'press grid size-9 place-items-center',
              'focus-visible:outline-text focus-visible:outline-2 focus-visible:-outline-offset-2',
              pressed
                ? 'bg-raised text-text shadow-[inset_0_-2px_0_var(--color-mint)]'
                : 'text-text-3 hover-fine:text-text'
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
