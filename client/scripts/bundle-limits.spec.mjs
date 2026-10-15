// Budget limits of the Next build (CCC-71): the catch-all route's gzip limit and the raw limit of
// every chunk. The CLI fails CI with these messages.
import { describe, expect, it } from 'vitest'
import { findBudgetViolations } from './bundle-limits.mjs'

const KB = 1000
const CATCH_ALL_LIMIT_KB = 440

/** A report shaped like `buildBundleReport`, with the catch-all and the largest chunk set. */
function reportWith({ catchAllGzipKb = 430, largestChunkRawKb = 355.84 } = {}) {
  return {
    routes: [
      { route: '/_not-found', initialGzipKb: 181.96 },
      { route: '/[[...slug]]', initialGzipKb: catchAllGzipKb },
    ],
    largestChunk: {
      file: 'static/chunks/app.js',
      rawKb: largestChunkRawKb,
      rawBytes: largestChunkRawKb * KB,
    },
  }
}

describe('findBudgetViolations', () => {
  it('passes when the catch-all and every chunk are within their limits', () => {
    expect(findBudgetViolations(reportWith())).toEqual([])
  })

  it('passes when the catch-all sits exactly at its limit', () => {
    expect(findBudgetViolations(reportWith({ catchAllGzipKb: CATCH_ALL_LIMIT_KB }))).toEqual([])
  })

  it('names the catch-all route and both numbers when its initial JavaScript is over the limit', () => {
    expect(findBudgetViolations(reportWith({ catchAllGzipKb: 441.2 }))).toEqual([
      'Initial JavaScript for /[[...slug]] is 441.2 kB gzip, above its 440 kB limit.',
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
    report.routes = report.routes.filter((entry) => entry.route !== '/[[...slug]]')

    expect(findBudgetViolations(report)).toEqual([
      'Route /[[...slug]] is missing from the bundle report, so its 440 kB limit is not checked.',
    ])
  })
})
