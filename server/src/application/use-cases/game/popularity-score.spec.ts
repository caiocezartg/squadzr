import { describe, expect, it } from 'vitest'
import type { GamePopularitySignals } from '@domain/services/game-catalog-source.interface'
import { computePopularityScores } from './popularity-score'

function signals(
  playing: number | null,
  steamPeakPlayers: number | null = null
): GamePopularitySignals {
  return { playing, steamPeakPlayers }
}

describe('computePopularityScores', () => {
  it('gives the top game of a signal 10000 and ranks the rest by percentile', () => {
    expect(computePopularityScores([signals(10), signals(40), signals(20), signals(30)])).toEqual([
      2500, 10_000, 5000, 7500,
    ])
  })

  it('lets tied games share one percentile', () => {
    expect(computePopularityScores([signals(5), signals(5), signals(9)])).toEqual([
      6667, 6667, 10_000,
    ])
    expect(computePopularityScores([signals(7), signals(7)])).toEqual([10_000, 10_000])
  })

  it('scores a game without any signal 0', () => {
    expect(computePopularityScores([signals(null, null), signals(3)])).toEqual([0, 10_000])
  })

  it('ranks each signal only among the games that have it', () => {
    // Only two games have a Steam peak, so the lower one sits at 0.5, not 1/3.
    expect(
      computePopularityScores([signals(null, 100), signals(null, 500), signals(null, null)])
    ).toEqual([5000, 10_000, 0])
  })

  it('takes the better of the two percentiles', () => {
    expect(
      computePopularityScores([
        signals(1, 900), // low Playing, top Steam peak
        signals(50, 10), // top Playing, low Steam peak
        signals(25, 400),
      ])
    ).toEqual([10_000, 10_000, 6667])
  })

  it('returns an integer between 0 and 10000 for every game', () => {
    const scores = computePopularityScores(
      Array.from({ length: 97 }, (_, index) =>
        signals(index % 3 === 0 ? null : (index * 7.31) % 53, index % 5 === 0 ? null : index * 13)
      )
    )

    for (const score of scores) {
      expect(Number.isInteger(score)).toBe(true)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(10_000)
    }
  })

  it('handles an empty candidate list', () => {
    expect(computePopularityScores([])).toEqual([])
  })
})
