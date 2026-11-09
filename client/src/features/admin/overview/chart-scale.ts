import type { ActivityRowDto } from '@squadzr/schemas'

/** The chart's drawing box (reference, Admin panel, Overview): 1000 wide, 240 tall, stretched to fit. */
export const CHART_WIDTH = 1000
export const CHART_HEIGHT = 240
const PLOT_HEIGHT = 228

/** The y axis has four steps above zero. */
export const Y_STEPS = 4

const NICE_FACTORS = [1, 2, 2.5, 5, 10]

/** The smallest round whole step at least `raw`: 1, 2, 5, 10, 20, 25, 50… */
function niceStep(raw: number): number {
  if (raw <= 1) return 1
  const power = 10 ** Math.floor(Math.log10(raw))
  for (const factor of NICE_FACTORS) {
    const step = factor * power
    if (step >= raw && Number.isInteger(step)) return step
  }
  return 10 * power
}

/** The y axis's step: four of them reach above the highest value of either series, with headroom. */
export function yStep(rows: readonly ActivityRowDto[]): number {
  const values = rows.flatMap((row) => [row.current ?? 0, row.previous ?? 0])
  return niceStep((Math.max(0, ...values) * 1.05) / Y_STEPS)
}

/** The x of the row at `index` of `count`, in drawing units. */
export function xAt(index: number, count: number): number {
  return count <= 1 ? CHART_WIDTH / 2 : (index / (count - 1)) * CHART_WIDTH
}

/** The y of `value` on an axis that tops at `max`, in drawing units (and pixels: the box is 240px). */
export function yAt(value: number, max: number): number {
  return CHART_HEIGHT - (value / max) * PLOT_HEIGHT
}

/** A day of a series that has a value, at its place in the series. */
export interface SeriesPoint {
  readonly index: number
  readonly value: number
}

/**
 * The runs of consecutive days that have a value, in order: a day with no value ends a run, so a line
 * drawn per run leaves a gap there instead of falling to zero.
 */
export function continuousSegments(values: readonly (number | null)[]): SeriesPoint[][] {
  const segments: SeriesPoint[][] = []
  let run: SeriesPoint[] = []
  values.forEach((value, index) => {
    if (value === null) {
      if (run.length > 0) segments.push(run)
      run = []
      return
    }
    run.push({ index, value })
  })
  if (run.length > 0) segments.push(run)
  return segments
}

function pointAt(point: SeriesPoint, count: number, max: number): string {
  return `${xAt(point.index, count).toFixed(1)} ${yAt(point.value, max).toFixed(1)}`
}

/**
 * The line through a series' values, one subpath per run of days that have one: a day with no value
 * breaks the line. A lone day between gaps has no line to be part of; `dotPath` marks it.
 */
export function linePath(values: readonly (number | null)[], max: number): string {
  return continuousSegments(values)
    .filter((segment) => segment.length > 1)
    .map((segment) =>
      segment
        .map((point, at) => `${at === 0 ? 'M' : 'L'}${pointAt(point, values.length, max)}`)
        .join(' ')
    )
    .join(' ')
}

/**
 * The lone days of a series (a value with no value on either side), each a zero-length subpath that a
 * round line cap draws as a dot.
 */
export function dotPath(values: readonly (number | null)[], max: number): string {
  return continuousSegments(values)
    .filter((segment) => segment.length === 1)
    .map(([point]) => (point ? `M${pointAt(point, values.length, max)} h0` : ''))
    .join(' ')
}

/** Whether a series pair has no value on any day, in either period. */
export function hasNoData(rows: readonly ActivityRowDto[]): boolean {
  return rows.every((row) => row.current === null && row.previous === null)
}

/**
 * The rows that get a date under the x axis: every `step`th counted back from the last day, so the
 * latest day is always labelled.
 */
export function labelledIndexes(count: number, step: number): number[] {
  const indexes: number[] = []
  for (let index = count - 1; index >= 0; index -= step) indexes.push(index)
  return indexes.reverse()
}

/** How many days apart the x axis labels sit, per period, on a wide chart and on a narrow one. */
export function labelStep(period: number, narrow: boolean): number {
  if (period <= 7) return narrow ? 3 : 1
  if (period <= 30) return narrow ? 14 : 7
  return narrow ? 44 : 21
}
