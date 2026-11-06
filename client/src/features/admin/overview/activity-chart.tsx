'use client'

import { useTranslations } from 'next-intl'
import type { ActivityRowDto } from '@squadzr/schemas'
import { ActivityTooltip } from './activity-tooltip'
import { XAxisLabels, YAxisLabels } from './chart-axes'
import { CHART_HEIGHT, CHART_WIDTH, linePath, xAt, yAt, Y_STEPS, yStep } from './chart-scale'
import { useChartCursor } from './use-chart-cursor'

interface ActivityChartProps {
  /** Every day of the period, oldest first. */
  readonly rows: readonly ActivityRowDto[]
  readonly period: number
}

const GRID_LEVELS = Array.from({ length: Y_STEPS + 1 }, (_, level) => level)

/** A dot on a series at the crosshair; a day with no value has none. */
function CursorDot({
  value,
  max,
  tone,
}: {
  readonly value: number | null
  readonly max: number
  readonly tone: string
}) {
  if (value === null) return null
  return (
    <span
      aria-hidden="true"
      style={{ top: yAt(value, max) }}
      className={`pointer-events-none absolute left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_var(--color-panel)] ${tone}`}
    />
  )
}

/**
 * The Activity chart (reference, Admin panel, Overview), drawn by hand in SVG: the period in a 2px mint
 * line over the previous period's dashed muted one, on a five-line grid. Pointing at a day, touching it
 * or focusing the chart and using the arrow keys stands a crosshair on it with a card of both values.
 * The same days are in the table view, which is how a screen reader reads them.
 */
export function ActivityChart({ rows, period }: ActivityChartProps) {
  const t = useTranslations('admin.overview.activity')
  const step = yStep(rows)
  const max = step * Y_STEPS
  const { active, handlers } = useChartCursor(rows.length)
  const activeRow = active === null ? undefined : rows[active]
  const left = active === null ? 0 : (xAt(active, rows.length) / CHART_WIDTH) * 100

  return (
    <div className="relative pl-8.5 sm:pl-11">
      <YAxisLabels step={step} />
      <div
        role="group"
        tabIndex={0}
        aria-label={t('chartLabel')}
        {...handlers}
        className="focus-visible:outline-text relative h-60 touch-pan-y focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="block h-60 w-full overflow-visible"
        >
          {GRID_LEVELS.map((level) => {
            const y = yAt(level * step, max)
            return (
              <line
                key={level}
                x1={0}
                x2={CHART_WIDTH}
                y1={y}
                y2={y}
                stroke={level === 0 ? 'var(--color-track)' : 'var(--color-raised-2)'}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
          <path
            d={linePath(
              rows.map((row) => row.previous),
              max
            )}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={linePath(
              rows.map((row) => row.current),
              max
            )}
            fill="none"
            stroke="var(--color-mint)"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {activeRow && (
          <>
            <div
              aria-hidden="true"
              style={{ left: `${left}%` }}
              className="bg-track pointer-events-none absolute inset-y-0 w-px"
            >
              <CursorDot value={activeRow.previous} max={max} tone="bg-muted" />
              <CursorDot value={activeRow.current} max={max} tone="bg-mint" />
            </div>
            <ActivityTooltip row={activeRow} left={left} />
          </>
        )}
      </div>
      <XAxisLabels rows={rows} period={period} />
    </div>
  )
}
