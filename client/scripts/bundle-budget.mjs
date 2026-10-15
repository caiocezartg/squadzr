#!/usr/bin/env bun
/**
 * Bundle report for the Next production build (CCC-43, CCC-70).
 *
 * Reads the build output in `.next/` and writes `.next/bundle-report.json` with:
 *
 * - Initial JavaScript per route, gzip: the framework chunks every page loads
 *   (`rootMainFiles` and `polyfillFiles`) plus the client chunks of the route's
 *   entry modules (`entryJSFiles`). Each file is counted once.
 * - The largest emitted JavaScript chunk, by raw bytes.
 *
 * The script only reports. Limits are enforced by a later change, so it exits 0
 * once the report is written. Routes and files are sorted, the report has no
 * timestamps, and gzip uses a fixed level, so the output is deterministic.
 * kB = 1000 bytes.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { gzipSync } from 'node:zlib'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = resolve(SCRIPT_DIR, '..')
const NEXT_DIR = join(CLIENT_DIR, '.next')
const REPORT_PATH = join(NEXT_DIR, 'bundle-report.json')
const APP_ROUTES_MANIFEST = join(NEXT_DIR, 'app-path-routes-manifest.json')

const KB = 1000

function toPosix(path) {
  return path.split(sep).join('/')
}

function roundKb(bytes) {
  return Number((bytes / KB).toFixed(2))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Route manifests of one app page, e.g. `/[[...slug]]/page` in `.next/server/app/[[...slug]]/`. */
function pageManifestPaths(pageKey) {
  const segmentDir = join(NEXT_DIR, 'server', 'app', pageKey.replace(/\/page$/, '').slice(1))
  return {
    buildManifest: join(segmentDir, 'page', 'build-manifest.json'),
    clientReferenceManifest: join(segmentDir, 'page_client-reference-manifest.js'),
  }
}

/** Client reference manifest of a page. Next writes it as a script that assigns to `__RSC_MANIFEST`. */
function clientReferenceEntries(file, pageKey) {
  const context = createContext({})
  runInContext(readFileSync(file, 'utf8'), context)
  return context.__RSC_MANIFEST[pageKey].entryJSFiles
}

/** Initial JavaScript files of a page, deduplicated and sorted, relative to `.next/`. */
function initialJavascriptFiles(pageKey) {
  const paths = pageManifestPaths(pageKey)
  const buildManifest = readJson(paths.buildManifest)
  const entries = clientReferenceEntries(paths.clientReferenceManifest, pageKey)
  const entryFiles = Object.values(entries).flat()
  const files = [...buildManifest.rootMainFiles, ...buildManifest.polyfillFiles, ...entryFiles]

  return [...new Set(files)].filter((file) => file.endsWith('.js')).sort()
}

/** Raw and gzip byte sizes of a file in `.next/`. */
function assetSize(file) {
  const raw = readFileSync(join(NEXT_DIR, file))
  return { rawBytes: raw.byteLength, gzipBytes: gzipSync(raw, { level: 9 }).byteLength }
}

function measureRoute(pageKey, route) {
  const files = initialJavascriptFiles(pageKey).map((file) => ({ file, ...assetSize(file) }))
  const initialRawBytes = files.reduce((total, asset) => total + asset.rawBytes, 0)
  const initialGzipBytes = files.reduce((total, asset) => total + asset.gzipBytes, 0)

  return {
    route,
    page: pageKey,
    initialRawKb: roundKb(initialRawBytes),
    initialGzipKb: roundKb(initialGzipBytes),
    files: files.map((asset) => ({
      file: asset.file,
      rawKb: roundKb(asset.rawBytes),
      gzipKb: roundKb(asset.gzipBytes),
    })),
  }
}

/** Every JavaScript file under `.next/static/chunks`, as paths relative to `.next/`. */
function emittedJavascriptChunks(dir = join(NEXT_DIR, 'static', 'chunks')) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return emittedJavascriptChunks(path)
    return entry.name.endsWith('.js') ? [toPosix(relative(NEXT_DIR, path))] : []
  })
}

function largestChunk(files) {
  const [largest] = files
    .map((file) => ({ file, rawBytes: statSync(join(NEXT_DIR, file)).size }))
    .sort((a, b) => b.rawBytes - a.rawBytes || a.file.localeCompare(b.file))

  return { file: largest.file, rawKb: roundKb(largest.rawBytes), rawBytes: largest.rawBytes }
}

function printRouteTable(routes) {
  const header = ['route', 'initial JS (gzip)']
  const rows = routes.map((route) => [route.route, `${route.initialGzipKb} kB`])
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

const routes = Object.entries(readJson(APP_ROUTES_MANIFEST))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([pageKey, route]) => measureRoute(pageKey, route))

const chunkFiles = emittedJavascriptChunks()
const largest = largestChunk(chunkFiles)

const report = {
  schemaVersion: 1,
  command: 'bun run bundle:budget',
  tool: 'client/scripts/bundle-budget.mjs',
  definitions: {
    initialJavaScript:
      'Framework chunks (rootMainFiles, polyfillFiles) and the client chunks of the route entry modules (entryJSFiles), each file counted once, summed after gzip level 9.',
    largestChunk: 'The largest JavaScript file under .next/static/chunks, by raw bytes.',
    units: 'kB = 1000 bytes',
  },
  routes,
  largestChunk: largest,
  chunkCount: chunkFiles.length,
}

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`Bundle report written to ${toPosix(relative(CLIENT_DIR, REPORT_PATH))}`)
printRouteTable(routes)
console.log(`Largest chunk: ${largest.file} (${largest.rawKb} kB raw)`)
