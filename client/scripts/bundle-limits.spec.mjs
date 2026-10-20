// Budget limits of the Next build (CCC-71, CCC-77, CCC-79, CCC-80, CCC-81): the landing's, the catch-all's,
// the Squad Board's, My Squads' and the Lobby's gzip limits and the raw limit of every chunk. The CLI fails
// CI with these messages.
import { describe, expect, it } from 'vitest'
import { findBudgetViolations } from './bundle-limits.mjs'

const KB = 1000
const LANDING_LIMIT_KB = 340
const CATCH_ALL_LIMIT_KB = 440
const SQUAD_BOARD_LIMIT_KB = 375
const MY_SQUADS_LIMIT_KB = 365
const LOBBY_LIMIT_KB = 335

/** A report shaped like `buildBundleReport`, with the landing, the catch-all, the Squad Board and the largest chunk set. */
function reportWith({
  landingGzipKb = 335,
  catchAllGzipKb = 430,
  squadBoardGzipKb = 373.77,
  mySquadsGzipKb = 364.26,
  lobbyGzipKb = 332.52,
  largestChunkRawKb = 355.84,
} = {}) {
  return {
    routes: [
      { route: '/', initialGzipKb: landingGzipKb },
      { route: '/_not-found', initialGzipKb: 312.79 },
      { route: '/[...slug]', initialGzipKb: catchAllGzipKb },
      { route: '/squads', initialGzipKb: squadBoardGzipKb },
      { route: '/squads/my', initialGzipKb: mySquadsGzipKb },
      { route: '/squads/[code]', initialGzipKb: lobbyGzipKb },
    ],
    largestChunk: {
      file: 'static/chunks/app.js',
      rawKb: largestChunkRawKb,
      rawBytes: largestChunkRawKb * KB,
    },
  }
}

describe('findBudgetViolations', () => {
  it('passes when the landing, the catch-all and every chunk are within their limits', () => {
    expect(findBudgetViolations(reportWith())).toEqual([])
  })

  it('passes when the landing sits exactly at its limit', () => {
    expect(findBudgetViolations(reportWith({ landingGzipKb: LANDING_LIMIT_KB }))).toEqual([])
  })

  it('names the landing and both numbers when its initial JavaScript is over the limit', () => {
    expect(findBudgetViolations(reportWith({ landingGzipKb: 340.5 }))).toEqual([
      'Initial JavaScript for / is 340.5 kB gzip, above its 340 kB limit.',
    ])
  })

  it('fails when the landing is missing from the report, so its limit cannot pass unchecked', () => {
    const report = reportWith()
    report.routes = report.routes.filter((entry) => entry.route !== '/')

    expect(findBudgetViolations(report)).toEqual([
      'Route / is missing from the bundle report, so its 340 kB limit is not checked.',
    ])
  })

  it('passes when the catch-all sits exactly at its limit', () => {
    expect(findBudgetViolations(reportWith({ catchAllGzipKb: CATCH_ALL_LIMIT_KB }))).toEqual([])
  })

  it('names the catch-all route and both numbers when its initial JavaScript is over the limit', () => {
    expect(findBudgetViolations(reportWith({ catchAllGzipKb: 441.2 }))).toEqual([
      'Initial JavaScript for /[...slug] is 441.2 kB gzip, above its 440 kB limit.',
    ])
  })

  it('names the chunk and the limit when a chunk is over 500 kB raw', () => {
    expect(findBudgetViolations(reportWith({ largestChunkRawKb: 510.5 }))).toEqual([
      'Chunk static/chunks/app.js is 510.5 kB raw, above the 500 kB limit.',
    ])
  })

  it('passes when the Squad Board sits exactly at its limit', () => {
    expect(findBudgetViolations(reportWith({ squadBoardGzipKb: SQUAD_BOARD_LIMIT_KB }))).toEqual([])
  })

  it('names the Squad Board route and both numbers when its initial JavaScript is over the limit', () => {
    expect(findBudgetViolations(reportWith({ squadBoardGzipKb: 375.5 }))).toEqual([
      'Initial JavaScript for /squads is 375.5 kB gzip, above its 375 kB limit.',
    ])
  })

  it('reports each broken limit, not only the first', () => {
    expect(
      findBudgetViolations(reportWith({ catchAllGzipKb: 441.2, largestChunkRawKb: 510.5 }))
    ).toHaveLength(2)
  })

  it('fails when the Squad Board route is missing from the report, so its limit cannot pass unchecked', () => {
    const report = reportWith()
    report.routes = report.routes.filter((entry) => entry.route !== '/squads')

    expect(findBudgetViolations(report)).toEqual([
      'Route /squads is missing from the bundle report, so its 375 kB limit is not checked.',
    ])
  })

  it('passes when My Squads sits exactly at its limit', () => {
    expect(findBudgetViolations(reportWith({ mySquadsGzipKb: MY_SQUADS_LIMIT_KB }))).toEqual([])
  })

  it('names the My Squads route and both numbers when its initial JavaScript is over the limit', () => {
    expect(findBudgetViolations(reportWith({ mySquadsGzipKb: 365.5 }))).toEqual([
      'Initial JavaScript for /squads/my is 365.5 kB gzip, above its 365 kB limit.',
    ])
  })

  it('fails when the My Squads route is missing from the report, so its limit cannot pass unchecked', () => {
    const report = reportWith()
    report.routes = report.routes.filter((entry) => entry.route !== '/squads/my')

    expect(findBudgetViolations(report)).toEqual([
      'Route /squads/my is missing from the bundle report, so its 365 kB limit is not checked.',
    ])
  })

  it('passes when the Lobby is at its limit', () => {
    expect(findBudgetViolations(reportWith({ lobbyGzipKb: LOBBY_LIMIT_KB }))).toEqual([])
  })

  it('fails when the Lobby exceeds its limit', () => {
    expect(findBudgetViolations(reportWith({ lobbyGzipKb: 335.5 }))).toEqual([
      'Initial JavaScript for /squads/[code] is 335.5 kB gzip, above its 335 kB limit.',
    ])
  })

  it('fails when the Lobby route is missing from the report, so its limit cannot pass unchecked', () => {
    const report = reportWith()
    report.routes = report.routes.filter((entry) => entry.route !== '/squads/[code]')

    expect(findBudgetViolations(report)).toEqual([
      'Route /squads/[code] is missing from the bundle report, so its 335 kB limit is not checked.',
    ])
  })

  it('fails when the catch-all route is missing from the report, so its limit cannot pass unchecked', () => {
    const report = reportWith()
    report.routes = report.routes.filter((entry) => entry.route !== '/[...slug]')

    expect(findBudgetViolations(report)).toEqual([
      'Route /[...slug] is missing from the bundle report, so its 440 kB limit is not checked.',
    ])
  })
})
