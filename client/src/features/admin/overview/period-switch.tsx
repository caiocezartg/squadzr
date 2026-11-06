'use client'

import { useTranslations } from 'next-intl'
import { OVERVIEW_PERIODS, type OverviewPeriod } from '@squadzr/schemas'
import { cn } from '@/lib/utils'

interface PeriodSwitchProps {
  readonly value: OverviewPeriod
  readonly onChange: (period: OverviewPeriod) => void
}

/**
 * The Overview's period (reference, Admin panel, Overview): 7, 30 or 90 days, as toggle buttons in a
 * hairline box, the pressed one raised over a mint underline. The tiles and the chart follow it.
 */
export function PeriodSwitch({ value, onChange }: PeriodSwitchProps) {
  const t = useTranslations('admin.overview.period')

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex shadow-[inset_0_0_0_1px_var(--color-line)]"
    >
      {OVERVIEW_PERIODS.map((period) => {
        const pressed = period === value

        return (
          <button
            key={period}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(period)}
            className={cn(
              'press h-10 px-4 text-[13px] font-extrabold whitespace-nowrap',
              'focus-visible:outline-text focus-visible:outline-2 focus-visible:-outline-offset-2',
              pressed
                ? 'bg-raised text-text shadow-[inset_0_-2px_0_var(--color-mint)]'
                : 'text-text-3 hover-fine:text-text'
            )}
          >
            {t('days', { count: period })}
          </button>
        )
      })}
    </div>
  )
}
