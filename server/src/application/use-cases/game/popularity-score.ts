import type { GamePopularitySignals } from '@domain/services/game-catalog-source.interface'

/** The score is a percentile scaled to this integer range: 0 (no signal) to 10000 (top). */
export const POPULARITY_SCORE_SCALE = 10_000

/**
 * The percentile of every value among the values that exist: the share of
 * them that are lower than or equal to it. The top value is 1.0 and equal
 * values share one percentile.
 */
function percentiles(values: readonly number[]): Map<number, number> {
  const sorted = [...values].sort((a, b) => a - b)
  const byValue = new Map<number, number>()

  sorted.forEach((value, index) => {
    // The last index of a run of equal values counts every value up to it.
    byValue.set(value, (index + 1) / sorted.length)
  })

  return byValue
}

function presentValues(
  signals: readonly GamePopularitySignals[],
  pick: (signal: GamePopularitySignals) => number | null
): number[] {
  return signals.map(pick).filter((value): value is number => value !== null)
}

/**
 * Turns the raw popularity signals of a candidate list into one integer score
 * per game, in the same order. Each signal is ranked only among the games that
 * have it, a game without a signal gets 0 for it, and the better of the two
 * percentiles becomes `round(max × 10000)`.
 */
export function computePopularityScores(signals: readonly GamePopularitySignals[]): number[] {
  const playing = percentiles(presentValues(signals, (signal) => signal.playing))
  const steam = percentiles(presentValues(signals, (signal) => signal.steamPeakPlayers))

  return signals.map((signal) => {
    const playingPercentile = signal.playing === null ? 0 : (playing.get(signal.playing) ?? 0)
    const steamPercentile =
      signal.steamPeakPlayers === null ? 0 : (steam.get(signal.steamPeakPlayers) ?? 0)

    return Math.round(Math.max(playingPercentile, steamPercentile) * POPULARITY_SCORE_SCALE)
  })
}
