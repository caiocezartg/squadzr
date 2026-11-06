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

/**
 * The line through a series' values. A day with no value breaks the line, which starts again at the
 * next day that has one.
 */
export function linePath(values: readonly (number | null)[], max: number): string {
  let drawing = false
  return values
    .map((value, index) => {
      if (value === null) {
        drawing = false
        return ''
      }
      const command = drawing ? 'L' : 'M'
      drawing = true
      return `${command}${xAt(index, values.length).toFixed(1)} ${yAt(value, max).toFixed(1)}`
    })
    .filter(Boolean)
    .join(' ')
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
