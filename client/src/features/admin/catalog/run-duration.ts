/** How long a run took, split for display: under a minute in seconds, under an hour in minutes and seconds. */
export type RunDuration =
  | { readonly unit: 'seconds'; readonly seconds: number }
  | { readonly unit: 'minutes'; readonly minutes: number; readonly seconds: number }
  | { readonly unit: 'hours'; readonly hours: number; readonly minutes: number }

/**
 * The time between a run's start and its end, rounded down to the second, or `null` while the run has
 * not both started and finished. A clock that put the end before the start reads as zero.
 */
export function runDuration(
  startedAt: string | null,
  finishedAt: string | null
): RunDuration | null {
  if (startedAt === null || finishedAt === null) return null
  const total = Math.max(
    0,
    Math.floor((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  )
  if (total < 60) return { unit: 'seconds', seconds: total }
  if (total < 3600) return { unit: 'minutes', minutes: Math.floor(total / 60), seconds: total % 60 }
  return {
    unit: 'hours',
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
  }
}
