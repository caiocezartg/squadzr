// Regression check for the bundle report (CCC-70). A route that loads a client chunk through
// `next/dynamic` counts its chunks as initial JavaScript; a route that does not load them does not.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gzip } from 'pako'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildBundleReport } from './bundle-report.mjs'

const CHUNK_NAMES = ['framework', 'polyfill', 'entry', 'squads', 'squads-deps', 'not-found']

// Distinct contents, so every chunk has its own gzip size.
const CHUNKS = Object.fromEntries(
  CHUNK_NAMES.map((name) => [`static/chunks/${name}.js`, `// ${name}\n`.repeat(200)])
)

/** The manifests Next writes for one app page, under `.next/server/app/<segment>/`. */
function pageManifests(segment, pageKey, entryFiles, loadableManifest) {
  const dir = `server/app/${segment}`
  return {
    [`${dir}/page/build-manifest.json`]: {
      rootMainFiles: ['static/chunks/framework.js'],
      polyfillFiles: ['static/chunks/polyfill.js'],
    },
    [`${dir}/page_client-reference-manifest.js`]: [
      'globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};',
      `globalThis.__RSC_MANIFEST[${JSON.stringify(pageKey)}] = ${JSON.stringify({
        entryJSFiles: { 'app/page': entryFiles },
      })};`,
    ].join('\n'),
    [`${dir}/page/react-loadable-manifest.json`]: loadableManifest,
  }
}

// `/squads` loads a client chunk through `next/dynamic`; `/_not-found` loads no dynamic import.
const FIXTURE = {
  'app-path-routes-manifest.json': {
    '/squads/page': '/squads',
    '/_not-found/page': '/_not-found',
  },
  ...pageManifests('squads', '/squads/page', ['static/chunks/entry.js'], {
    28991: {
      id: 28991,
      files: ['static/chunks/squads.js', 'static/chunks/squads-deps.js', 'static/chunks/entry.js'],
    },
  }),
  ...pageManifests('_not-found', '/_not-found/page', ['static/chunks/not-found.js'], {}),
  ...CHUNKS,
}

// `entry.js` is both an entry chunk and a dynamic chunk of `/squads`, so it is listed once.
const SQUADS_ROUTE = [
  'static/chunks/entry.js',
  'static/chunks/framework.js',
  'static/chunks/polyfill.js',
  'static/chunks/squads-deps.js',
  'static/chunks/squads.js',
]
const NOT_FOUND_ROUTE = [
  'static/chunks/framework.js',
  'static/chunks/not-found.js',
  'static/chunks/polyfill.js',
]

/** Writes the fixture under `nextDir`: strings as they are, other values as JSON. */
function writeFixture(nextDir) {
  for (const [file, content] of Object.entries(FIXTURE)) {
    mkdirSync(dirname(join(nextDir, file)), { recursive: true })
    writeFileSync(
      join(nextDir, file),
      typeof content === 'string' ? content : JSON.stringify(content)
    )
  }
}

/** Gzip size in kB of the given chunks, summed the way the report sums them. */
function gzipKb(files) {
  const bytes = files.reduce(
    (total, file) => total + gzip(CHUNKS[file], { level: 9 }).byteLength,
    0
  )
  return Number((bytes / 1000).toFixed(2))
}

function routeNamed(report, route) {
  return report.routes.find((entry) => entry.route === route)
}

describe('buildBundleReport', () => {
  let nextDir

  beforeEach(() => {
    nextDir = mkdtempSync(join(tmpdir(), 'bundle-report-'))
    writeFixture(nextDir)
  })

  afterEach(() => {
    rmSync(nextDir, { recursive: true, force: true })
  })

  it('counts the chunks of a dynamic import in the initial JavaScript, once each', () => {
    const route = routeNamed(buildBundleReport(nextDir), '/squads')

    expect(route.files.map((asset) => asset.file)).toEqual(SQUADS_ROUTE)
    expect(route.initialGzipKb).toBe(gzipKb(SQUADS_ROUTE))
  })

  it('does not count the dynamic chunks for a route that does not load them', () => {
    const route = routeNamed(buildBundleReport(nextDir), '/_not-found')

    expect(route.files.map((asset) => asset.file)).toEqual(NOT_FOUND_ROUTE)
    expect(route.initialGzipKb).toBe(gzipKb(NOT_FOUND_ROUTE))
  })
})
