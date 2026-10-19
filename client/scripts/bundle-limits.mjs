/**
 * Limits of the Next build (CCC-71, CCC-77). `findBudgetViolations` checks a report from `bundle-report.mjs`
 * against them and returns one message per violation; `bundle-budget.mjs` prints the messages and
 * fails the step.
 *
 * - The landing `/`, initial JavaScript, gzip: 340 kB. CI measures 336.43 kB, and the limit is that
 *   measurement rounded up to the next 5 kB (CCC-77). The root layout alone (`/_not-found`, 299.13 kB
 *   in CI) is loaded by every page, so the landing cannot meet a 200 kB cap while the layout stays
 *   as it is.
 * - The catch-all route's initial JavaScript, gzip: its CCC-70 baseline of 438.07 kB, rounded up to
 *   the next 5 kB. Routes without a limit are reported only.
 * - Every emitted JavaScript chunk, raw: at most 500 kB. The largest chunk decides it, because no
 *   other chunk can be larger.
 *
 * Limits compare the kB values the report prints (kB = 1000 bytes, two decimals), so a violation
 * message always shows the numbers it was decided on.
 */

/** Initial JavaScript limit per route, in kB gzip. */
export const ROUTE_LIMITS_GZIP_KB = {
  '/': 340,
  '/[...slug]': 440,
}

/** Largest raw size of any emitted JavaScript chunk, in kB. */
export const MAX_CHUNK_RAW_KB = 500

/**
 * The limits `report` breaks, one message each. An empty list means the report is within budget.
 */
export function findBudgetViolations(
  report,
  { routeLimitsGzipKb = ROUTE_LIMITS_GZIP_KB, maxChunkRawKb = MAX_CHUNK_RAW_KB } = {}
) {
  return [
    ...routeViolations(report, routeLimitsGzipKb),
    ...chunkViolations(report.largestChunk, maxChunkRawKb),
  ]
}

function routeViolations(report, routeLimitsGzipKb) {
  return Object.entries(routeLimitsGzipKb).flatMap(([route, limitKb]) => {
    const measured = report.routes.find((entry) => entry.route === route)

    if (!measured) {
      return [
        `Route ${route} is missing from the bundle report, so its ${limitKb} kB limit is not checked.`,
      ]
    }
    if (measured.initialGzipKb > limitKb) {
      return [
        `Initial JavaScript for ${route} is ${measured.initialGzipKb} kB gzip, above its ${limitKb} kB limit.`,
      ]
    }
    return []
  })
}

function chunkViolations(largestChunk, maxChunkRawKb) {
  if (largestChunk.rawKb <= maxChunkRawKb) return []

  return [
    `Chunk ${largestChunk.file} is ${largestChunk.rawKb} kB raw, above the ${maxChunkRawKb} kB limit.`,
  ]
}
