'use client'

import { useRef, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { ACTIVITY_METRICS, type ActivityMetric } from '@squadzr/schemas'
import { cn } from '@/lib/utils'

interface ActivityTabsProps {
  readonly value: ActivityMetric
  readonly onChange: (metric: ActivityMetric) => void
  /** The id of each tab, which its panel is labelled by. */
  readonly tabId: (metric: ActivityMetric) => string
  readonly panelId: string
}

const KEY_STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
}

/**
 * The Activity chart's metrics (reference, Admin panel, Overview), as tabs: the arrow keys, Home and End
 * move between them and select the one they reach, and only the selected one is in the tab order. They
 * scroll sideways below 640px rather than wrap.
 */
export function ActivityTabs({ value, onChange, tabId, panelId }: ActivityTabsProps) {
  const t = useTranslations('admin.overview.activity')
  const tabs = useRef<Partial<Record<ActivityMetric, HTMLButtonElement | null>>>({})

  const onKeyDown = (event: KeyboardEvent) => {
    const step = KEY_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const next = ACTIVITY_METRICS[step(ACTIVITY_METRICS.indexOf(value), ACTIVITY_METRICS.length)]
    if (next === undefined) return
    onChange(next)
    tabs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={t('tabsLabel')}
      onKeyDown={onKeyDown}
      className="scrollbar-thin flex w-full gap-0.5 overflow-x-auto sm:w-auto sm:flex-wrap sm:overflow-visible"
    >
      {ACTIVITY_METRICS.map((metric) => {
        const selected = metric === value

        return (
          <button
            key={metric}
            ref={(node) => {
              tabs.current[metric] = node
            }}
            id={tabId(metric)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(metric)}
            className={cn(
              'press h-9 flex-none px-3 text-[12.5px] font-extrabold whitespace-nowrap',
              'focus-visible:outline-text focus-visible:outline-2 focus-visible:-outline-offset-2',
              selected
                ? 'bg-raised-2 text-text shadow-[inset_0_0_0_1px_var(--color-track)]'
                : 'bg-card text-text-3 hover-fine:text-text'
            )}
          >
            {t(`tabs.${metric}`)}
          </button>
        )
      })}
    </div>
  )
}
