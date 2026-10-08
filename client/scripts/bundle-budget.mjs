#!/usr/bin/env bun
/**
 * Deterministic production bundle report and budget (CCC-43).
 *
 * The script reads the Vite production manifest (`dist/.vite/manifest.json`),
 * walks the static import graph of the entry and of each measured route, and
 * sums the gzip size of every JavaScript chunk a cold browser must download
 * before that route can paint. It writes `dist/bundle-report.json` and exits
 * non-zero when the budget regresses.
 *
 * Determinism: routes, chunks and files are visited in sorted, declared order;
 * the report contains no timestamps and no filesystem-order-dependent data.
 * Gzip sizes come from `node:zlib` at a fixed compression level.
 *
 * Definitions (also recorded in the report):
 *
 * - Initial JavaScript: the entry chunk linked by `index.html`, every chunk it
 *   statically imports, the route's on-demand component chunk, and every chunk
 *   that chunk statically imports. Chunks reachable only through a nested
 *   dynamic import (other routes, dialogs, notifications, the games badge) are
 *   not part of the first load.
 * - Shared chunk: a JavaScript chunk that is part of the initial set of the
 *   entry or of more than one measured route. Each route's sum counts it once.
 * - CSS and preload hints are reported separately; they are not added to the
 *   initial JavaScript sum.
 * - kB = 1000 bytes, matching Vite's reporter.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = resolve(SCRIPT_DIR, '..')
const DIST_DIR = join(CLIENT_DIR, 'dist')
const MANIFEST_PATH = join(DIST_DIR, '.vite', 'manifest.json')
const INDEX_HTML_PATH = join(DIST_DIR, 'index.html')
const REPORT_PATH = join(DIST_DIR, 'bundle-report.json')

const KB = 1000
const MAX_INITIAL_GZIP_KB = 200
const MAX_CHUNK_RAW_KB = 500
const ENTRY_KEY = 'index.html'

/**
 * The budgeted first loads. `landing` and `catalog` are the public budget;
 * the authenticated `lobby` is measured and reported with the same reference
 * target but does not fail the build on its own.
 */
const ROUTES = [
  {
    id: 'landing',
    label: 'Landing (/)',
    manifestKey: 'src/routes/index.tsx?tsr-split=component',
    budgeted: true,
  },
  {
    id: 'catalog',
    label: 'Squad Board (/rooms/)',
    manifestKey: 'src/routes/rooms/index.tsx?tsr-split=component',
    budgeted: true,
  },
  {
    id: 'lobby',
    label: 'Lobby (/rooms/$code, authenticated)',
    manifestKey: 'src/routes/rooms/$code.tsx?tsr-split=component',
    budgeted: false,
  },
]

/**
 * Approved exceptions to the gzip budget. An exception only covers the route
 * it names and only up to `maxGzipKb`; anything above stays a failure. Keep
 * the reason, approver and issue so the artifact is self-explanatory.
 *
 * @type {{ route: string, maxGzipKb: number, reason: string, approvedBy: string, issue: string }[]}
 */
const APPROVED_EXCEPTIONS = []

function fail(message) {
  throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

const manifest = readJson(MANIFEST_PATH)
const indexHtml = readFileSync(INDEX_HTML_PATH, 'utf8')

const sizeCache = new Map()

/** Raw and gzip byte sizes of a built asset, deterministically cached. */
function assetSize(relativeFile) {
  const cached = sizeCache.get(relativeFile)
  if (cached) return cached

  const absoluteFile = join(DIST_DIR, relativeFile)
  const raw = readFileSync(absoluteFile)
  const size = {
    rawBytes: raw.byteLength,
    gzipBytes: gzipSync(raw, { level: 9 }).byteLength,
  }
  sizeCache.set(relativeFile, size)
  return size
}

/** Manifest keys reachable from `seeds` through static imports, sorted. */
function staticClosure(seeds) {
  const visited = new Set()
  const queue = [...seeds]

  while (queue.length > 0) {
    const key = queue.shift()
    if (visited.has(key)) continue

    const record = manifest[key]
    if (!record) fail(`Manifest is missing the record for "${key}"`)
    visited.add(key)

    for (const imported of record.imports ?? []) queue.push(imported)
  }

  return [...visited].sort()
}

/** JavaScript files in a static closure, deduplicated and sorted. */
function javascriptFiles(keys) {
  const files = new Set()
  for (const key of keys) {
    const file = manifest[key].file
    if (file.endsWith('.js')) files.add(file)
  }
  return [...files].sort()
}

/** CSS files referenced by the chunks in a static closure, sorted. */
function cssFiles(keys) {
  const files = new Set()
  for (const key of keys) {
    for (const file of manifest[key].css ?? []) files.add(file)
  }
  return [...files].sort()
}

function roundKb(bytes) {
  return Number((bytes / KB).toFixed(2))
}

function routeMeasurement(route) {
  if (!(route.manifestKey in manifest)) {
    fail(
      `Manifest is missing the route chunk for "${route.id}" (${route.manifestKey}). ` +
        'Did the route split or the production build change?'
    )
  }

  const closure = staticClosure([ENTRY_KEY, route.manifestKey])
  const files = javascriptFiles(closure)
  const initialRawBytes = files.reduce((total, file) => total + assetSize(file).rawBytes, 0)
  const initialGzipBytes = files.reduce((total, file) => total + assetSize(file).gzipBytes, 0)
  const css = cssFiles(closure)

  return {
    route,
    files,
    css,
    initialRawBytes,
    initialGzipBytes,
  }
}

const measurements = ROUTES.map(routeMeasurement)

/** Files measured for the entry or for more than one route. */
const sharedFiles = (() => {
  const counts = new Map()
  for (const measurement of measurements) {
    for (const file of measurement.files) {
      counts.set(file, (counts.get(file) ?? 0) + 1)
    }
  }
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([file]) => file)
  )
})()

const routesReport = measurements.map((measurement) => {
  const { route, files, css } = measurement
  const exception = APPROVED_EXCEPTIONS.find((candidate) => candidate.route === route.id)
  const limitKb = exception ? exception.maxGzipKb : MAX_INITIAL_GZIP_KB
  const withinBudget = measurement.initialGzipBytes <= limitKb * KB

  return {
    id: route.id,
    label: route.label,
    budgeted: route.budgeted,
    withinBudget,
    initialRawKb: roundKb(measurement.initialRawBytes),
    initialGzipKb: roundKb(measurement.initialGzipBytes),
    limitGzipKb: limitKb,
    exceptionApplied: Boolean(exception),
    files: files.map((file) => ({
      file,
      shared: sharedFiles.has(file),
      rawKb: roundKb(assetSize(file).rawBytes),
      gzipKb: roundKb(assetSize(file).gzipBytes),
    })),
    css: css.map((file) => ({
      file,
      rawKb: roundKb(assetSize(file).rawBytes),
      gzipKb: roundKb(assetSize(file).gzipBytes),
    })),
  }
})

/** CSS shared by the measured first loads, reported next to the JS sum. */
const allCssFiles = [...new Set(measurements.flatMap((measurement) => measurement.css))].sort()
const cssReport = allCssFiles.map((file) => ({
  file,
  rawKb: roundKb(assetSize(file).rawBytes),
  gzipKb: roundKb(assetSize(file).gzipBytes),
}))

/** Preload/style hints found in index.html; reported, never summed. */
const preloadLinks = [...indexHtml.matchAll(/<link[^>]+href="([^"]+)"[^>]*>/g)]
  .map((match) => match[0])
  .filter((tag) => tag.includes('modulepreload') || tag.includes('stylesheet'))
  .map((tag) => {
    const href = /href="([^"]+)"/.exec(tag)?.[1] ?? ''
    const file = href.replace(/^\//, '')
    const rel = tag.includes('modulepreload') ? 'modulepreload' : 'stylesheet'
    return {
      rel,
      file,
      exists: file.length > 0 && file.startsWith('assets/'),
      ...(file.startsWith('assets/') ? { rawKb: roundKb(assetSize(file).rawBytes) } : {}),
    }
  })
  .sort((a, b) => a.file.localeCompare(b.file))

/** Every emitted JavaScript chunk, for the 500 kB raw per-chunk limit. */
function emittedJavascriptChunks() {
  const files = []
  for (const entry of readdirSync(DIST_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name !== 'assets') continue
    for (const asset of readdirSync(join(DIST_DIR, entry.name), { withFileTypes: true })) {
      if (!asset.isFile() || extname(asset.name) !== '.js') continue
      files.push(`assets/${asset.name}`)
    }
  }
  return files.sort()
}

const chunks = emittedJavascriptChunks().map((file) => {
  const stats = statSync(join(DIST_DIR, file))
  return { file, rawKb: roundKb(stats.size), rawBytes: stats.size }
})
const largestChunk = chunks.reduce((largest, chunk) =>
  chunk.rawBytes > largest.rawBytes ? chunk : largest
)
const oversizedChunks = chunks.filter((chunk) => chunk.rawBytes > MAX_CHUNK_RAW_KB * KB)

const violations = []
for (const route of routesReport) {
  if (route.budgeted && !route.withinBudget) {
    violations.push(
      `Initial JavaScript for ${route.id} is ${route.initialGzipKb} kB gzip, ` +
        `above the ${route.limitGzipKb} kB budget` +
        (route.exceptionApplied ? ' (exception limit)' : '')
    )
  }
}
for (const chunk of oversizedChunks) {
  violations.push(`Chunk ${chunk.file} is ${chunk.rawKb} kB raw, above ${MAX_CHUNK_RAW_KB} kB`)
}

function buildVersion() {
  const pkg = readJson(join(CLIENT_DIR, 'package.json'))
  let commit = process.env.GITHUB_SHA ?? null
  if (!commit) {
    try {
      commit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: CLIENT_DIR,
        encoding: 'utf8',
      }).trim()
    } catch {
      commit = null
    }
  }
  return {
    package: `${pkg.name}@${pkg.version}`,
    commit,
    node: process.version,
  }
}

const report = {
  schemaVersion: 1,
  command: 'bun run bundle:budget',
  tool: 'client/scripts/bundle-budget.mjs',
  buildVersion: buildVersion(),
  definitions: {
    initialJavaScript:
      'Entry chunk linked by index.html, its static imports, the route component chunk, and that chunk\u2019s static imports. Nested dynamic imports are excluded.',
    sharedChunk:
      'A JavaScript chunk in the initial set of the entry or of more than one measured route; counted once per route sum.',
    cssAndPreloads:
      'CSS files and modulepreload/stylesheet links are reported separately and are not part of the initial JavaScript sum.',
    units: 'kB = 1000 bytes',
  },
  budget: {
    maxInitialGzipKb: MAX_INITIAL_GZIP_KB,
    maxChunkRawKb: MAX_CHUNK_RAW_KB,
    budgetedRoutes: routesReport.filter((route) => route.budgeted).map((route) => route.id),
  },
  approvedExceptions: APPROVED_EXCEPTIONS,
  routes: routesReport,
  sharedChunks: [...sharedFiles]
    .sort()
    .map((file) => ({ file, gzipKb: roundKb(assetSize(file).gzipBytes) })),
  css: cssReport,
  preloads: preloadLinks,
  largestChunk,
  chunkCount: chunks.length,
  violations,
  pass: violations.length === 0,
}

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

function printRouteTable() {
  const header = ['route', 'initial gzip', 'limit', 'status']
  const rows = routesReport.map((route) => [
    route.id,
    `${route.initialGzipKb} kB`,
    `${route.limitGzipKb} kB`,
    route.budgeted ? (route.withinBudget ? 'ok' : 'FAIL') : 'reported',
  ])

  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...rows.map((row) => row[column].length))
  )
  const line = (cells) =>
    cells.map((cell, column) => cell.padEnd(widths[column])).join('  ')

  console.log('Bundle budget (initial JavaScript, gzip):')
  console.log(line(header))
  for (const row of rows) console.log(line(row))
}

console.log(`Bundle report written to ${relative(CLIENT_DIR, REPORT_PATH)}`)
printRouteTable()
console.log(
  `Largest chunk: ${largestChunk.file} (${largestChunk.rawKb} kB raw, limit ${MAX_CHUNK_RAW_KB} kB)`
)
if (cssReport.length > 0) {
  console.log(
    `CSS (reported separately): ${cssReport
      .map((file) => `${file.file} ${file.gzipKb} kB gzip`)
      .join(', ')}`
  )
}
if (report.approvedExceptions.length > 0) {
  console.log(`Approved exceptions: ${JSON.stringify(report.approvedExceptions)}`)
}

if (violations.length > 0) {
  console.error('\nBundle budget failed:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log('\nBundle budget passed.')
