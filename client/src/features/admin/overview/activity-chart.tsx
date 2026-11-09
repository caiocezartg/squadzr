'use client'

import { useTranslations } from 'next-intl'
import type { ActivityMetric, ActivityRowDto } from '@squadzr/schemas'
import { ActivityTooltip } from './activity-tooltip'
import { XAxisLabels, YAxisLabels } from './chart-axes'
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  dotPath,
  hasNoData,
  linePath,
  xAt,
  yAt,
  Y_STEPS,
  yStep,
} from './chart-scale'
import { useChartCursor } from './use-chart-cursor'

interface ActivityChartProps {
  /** Every day of the period, oldest first. */
  readonly rows: readonly ActivityRowDto[]
  readonly period: number
  /** The metric the rows count; a new metric or period draws the lines in again. */
  readonly metric: ActivityMetric
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
 * One series drawn on the chart: its line, broken at every day with no data, and a dot for each lone
 * day between such gaps, which has no line to be part of.
 */
function SeriesLine({
  values,
  max,
  stroke,
  width,
  dashed = false,
}: {
  readonly values: readonly (number | null)[]
  readonly max: number
  readonly stroke: string
  readonly width: number
  readonly dashed?: boolean
}) {
  const line = linePath(values, max)
  const dots = dotPath(values, max)

  return (
    <>
      {line && (
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={width}
          strokeDasharray={dashed ? '5 4' : undefined}
          strokeLinejoin={dashed ? undefined : 'round'}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {dots && (
        <path
          data-testid="activity-dots"
          d={dots}
          fill="none"
          stroke={stroke}
          strokeWidth={width * 3}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </>
  )
}

/**
 * The Activity chart (reference, Admin panel, Overview), drawn by hand in SVG: the period in a 2px mint
 * line over the previous period's dashed muted one, on a five-line grid. A day with no data is a gap in
 * its line, never a zero; with no data on any day the chart says so over an empty grid. Pointing at a day, touching it
 * or focusing the chart and using the arrow keys stands a crosshair on it with a card of both values.
 * The same days are in the table view, which is how a screen reader reads them. The lines draw in from
 * the left over the grid whenever a series lands, never holding the chart back.
 */
export function ActivityChart({ rows, period, metric }: ActivityChartProps) {
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
        </svg>
        <svg
          key={`${metric}-${period}`}
          data-testid="activity-lines"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="motion-safe:animate-line-draw pointer-events-none absolute inset-0 block h-60 w-full overflow-visible"
        >
          <SeriesLine
            values={rows.map((row) => row.previous)}
            max={max}
            stroke="var(--color-muted)"
            width={1.5}
            dashed
          />
          <SeriesLine
            values={rows.map((row) => row.current)}
            max={max}
            stroke="var(--color-mint)"
            width={2}
          />
        </svg>
        {hasNoData(rows) && (
          <p className="text-muted pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-[12.5px] font-medium">
            {t('empty')}
          </p>
        )}
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
