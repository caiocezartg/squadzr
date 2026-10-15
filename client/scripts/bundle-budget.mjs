#!/usr/bin/env bun
/**
 * Writes the bundle report of the Next build to `.next/bundle-report.json`, prints the route table
 * (CCC-43, CCC-70) and enforces the limits of `bundle-limits.mjs` (CCC-71). The report itself is
 * built by `bundle-report.mjs`.
 *
 * The report is written before the limits are checked. Each broken limit prints one message and
 * the script exits 1, which fails the `bundle:budget` step and therefore CI.
 */

import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBundleReport, toPosix } from './bundle-report.mjs'
import { ROUTE_LIMITS_GZIP_KB, findBudgetViolations } from './bundle-limits.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = resolve(SCRIPT_DIR, '..')
const NEXT_DIR = join(CLIENT_DIR, '.next')
const REPORT_PATH = join(NEXT_DIR, 'bundle-report.json')
const APP_ROUTES_MANIFEST = join(NEXT_DIR, 'app-path-routes-manifest.json')

function formatLimit(route) {
  const limitKb = ROUTE_LIMITS_GZIP_KB[route]
  return limitKb === undefined ? '-' : `${limitKb} kB`
}

function printRouteTable(routes) {
  const header = ['route', 'initial JS (gzip)', 'limit']
  const rows = routes.map((route) => [
    route.route,
    `${route.initialGzipKb} kB`,
    formatLimit(route.route),
  ])
  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...rows.map((row) => row[column].length))
  )
  const line = (cells) =>
    cells
      .map((cell, column) => cell.padEnd(widths[column]))
      .join('  ')
      .trimEnd()

  console.log(line(header))
  for (const row of rows) console.log(line(row))
}

if (!existsSync(APP_ROUTES_MANIFEST)) {
  throw new Error('No Next build output found in client/.next. Run `bun run build` first.')
}

const report = buildBundleReport(NEXT_DIR)
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`Bundle report written to ${toPosix(relative(CLIENT_DIR, REPORT_PATH))}`)
printRouteTable(report.routes)
console.log(`Largest chunk: ${report.largestChunk.file} (${report.largestChunk.rawKb} kB raw)`)

const violations = findBudgetViolations(report)
if (violations.length > 0) {
  console.error('\nBundle budget failed:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log('\nBundle budget passed.')
}
