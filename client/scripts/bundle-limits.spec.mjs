// Budget limits of the Next build (CCC-71, CCC-77): the landing's and the catch-all route's gzip limits
// and the raw limit of every chunk. The CLI fails CI with these messages.
import { describe, expect, it } from 'vitest'
import { findBudgetViolations } from './bundle-limits.mjs'

const KB = 1000
const LANDING_LIMIT_KB = 340
const CATCH_ALL_LIMIT_KB = 440

/** A report shaped like `buildBundleReport`, with the landing, the catch-all and the largest chunk set. */
function reportWith({ landingGzipKb = 335, catchAllGzipKb = 430, largestChunkRawKb = 355.84 } = {}) {
  return {
    routes: [
      { route: '/', initialGzipKb: landingGzipKb },
      { route: '/_not-found', initialGzipKb: 312.79 },
      { route: '/[...slug]', initialGzipKb: catchAllGzipKb },
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

  it('reports each broken limit, not only the first', () => {
    expect(
      findBudgetViolations(reportWith({ catchAllGzipKb: 441.2, largestChunkRawKb: 510.5 }))
    ).toHaveLength(2)
  })

  it('fails when the catch-all route is missing from the report, so its limit cannot pass unchecked', () => {
    const report = reportWith()
    report.routes = report.routes.filter((entry) => entry.route !== '/[...slug]')

    expect(findBudgetViolations(report)).toEqual([
      'Route /[...slug] is missing from the bundle report, so its 440 kB limit is not checked.',
    ])
  })
})
