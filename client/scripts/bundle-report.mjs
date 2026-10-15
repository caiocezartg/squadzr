/**
 * Bundle report of the Next production build (CCC-43, CCC-70).
 *
 * `buildBundleReport(nextDir)` reads a Next build output (`client/.next`) and returns the report:
 *
 * - Initial JavaScript per route, gzip: the framework chunks every page loads (`rootMainFiles` and
 *   `polyfillFiles`), the client chunks of the route's entry modules (`entryJSFiles`), and the chunks
 *   of its `next/dynamic` imports (`react-loadable-manifest.json`). A client-only route loads its
 *   code through such an import, so those chunks are initial JavaScript too. Each file is counted once.
 * - The largest emitted JavaScript chunk, by raw bytes.
 *
 * Routes and files are sorted, the report has no timestamps, and gzip uses a fixed level, so the
 * output is deterministic. kB = 1000 bytes. The report describes sizes only; limits come later.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { gzipSync } from 'node:zlib'

const KB = 1000

export function toPosix(path) {
  return path.split(sep).join('/')
}

function roundKb(bytes) {
  return Number((bytes / KB).toFixed(2))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Manifest files of one app page, e.g. `/[[...slug]]/page` in `.next/server/app/[[...slug]]/`. */
function pageManifestPaths(nextDir, pageKey) {
  const segmentDir = join(nextDir, 'server', 'app', pageKey.replace(/\/page$/, '').slice(1))
  return {
    buildManifest: join(segmentDir, 'page', 'build-manifest.json'),
    clientReferenceManifest: join(segmentDir, 'page_client-reference-manifest.js'),
    loadableManifest: join(segmentDir, 'page', 'react-loadable-manifest.json'),
  }
}

/** Client reference manifest of a page. Next writes it as a script that assigns to `__RSC_MANIFEST`. */
function clientReferenceEntries(file, pageKey) {
  const context = createContext({})
  runInContext(readFileSync(file, 'utf8'), context)
  return context.__RSC_MANIFEST[pageKey].entryJSFiles
}

/** Chunks of a page's `next/dynamic` imports. The manifest maps each module id to its chunk files. */
function dynamicImportFiles(file) {
  return Object.values(readJson(file)).flatMap((entry) => entry.files)
}

/** Initial JavaScript files of a page, deduplicated and sorted, relative to `.next/`. */
function initialJavascriptFiles(nextDir, pageKey) {
  const paths = pageManifestPaths(nextDir, pageKey)
  const buildManifest = readJson(paths.buildManifest)
  const entries = clientReferenceEntries(paths.clientReferenceManifest, pageKey)
  const entryFiles = Object.values(entries).flat()
  const files = [
    ...buildManifest.rootMainFiles,
    ...buildManifest.polyfillFiles,
    ...entryFiles,
    ...dynamicImportFiles(paths.loadableManifest),
  ]

  return [...new Set(files)].filter((file) => file.endsWith('.js')).sort()
}

/** Raw and gzip byte sizes of a file in `.next/`. */
function assetSize(nextDir, file) {
  const raw = readFileSync(join(nextDir, file))
  return { rawBytes: raw.byteLength, gzipBytes: gzipSync(raw, { level: 9 }).byteLength }
}

function measureRoute(nextDir, pageKey, route) {
  const files = initialJavascriptFiles(nextDir, pageKey).map((file) => ({
    file,
    ...assetSize(nextDir, file),
  }))
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

/** Every JavaScript file under `static/chunks` of a build, as paths relative to `.next/`. */
function emittedJavascriptChunks(nextDir, dir = join(nextDir, 'static', 'chunks')) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return emittedJavascriptChunks(nextDir, path)
    return entry.name.endsWith('.js') ? [toPosix(relative(nextDir, path))] : []
  })
}

function largestChunk(nextDir, files) {
  const [largest] = files
    .map((file) => ({ file, rawBytes: statSync(join(nextDir, file)).size }))
    .sort((a, b) => b.rawBytes - a.rawBytes || a.file.localeCompare(b.file))

  return { file: largest.file, rawKb: roundKb(largest.rawBytes), rawBytes: largest.rawBytes }
}

/** The bundle report of the Next build in `nextDir`, as plain data. The CLI writes it to disk. */
export function buildBundleReport(nextDir) {
  const routes = Object.entries(readJson(join(nextDir, 'app-path-routes-manifest.json')))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pageKey, route]) => measureRoute(nextDir, pageKey, route))

  const chunkFiles = emittedJavascriptChunks(nextDir)

  return {
    schemaVersion: 1,
    command: 'bun run bundle:budget',
    tool: 'client/scripts/bundle-budget.mjs',
    definitions: {
      initialJavaScript:
        'Framework chunks (rootMainFiles, polyfillFiles), the client chunks of the route entry modules (entryJSFiles), and the chunks of its next/dynamic imports (react-loadable-manifest.json), each file counted once, summed after gzip level 9.',
      largestChunk: 'The largest JavaScript file under .next/static/chunks, by raw bytes.',
      units: 'kB = 1000 bytes',
    },
    routes,
    largestChunk: largestChunk(nextDir, chunkFiles),
    chunkCount: chunkFiles.length,
  }
}
