/**
 * Capability boundary enforcement (CCC-42).
 *
 * Client code is organized by capability (docs/adr/0001): each
 * `src/features/<capability>` keeps its query keys, realtime names and
 * presentation internal and exposes a small public interface. This test walks
 * the real source tree and enforces two structural rules:
 *
 * - there are no import cycles between capability modules. The graph is
 *   checked per module (file), not per capability, and no loop is allowed: the
 *   Squad Board's barrel exports only its cache commands and its page is a
 *   separate `page` entry, so creation and joining reach the board without
 *   pulling the page back in;
 * - every non-test source file under `src/` (capabilities, App Router pages,
 *   components and the rest) only reaches another capability through a public
 *   entry point (`index.ts`, `skeleton` and `page`).
 *
 * The scan is source-level on purpose: it sees every specifier, including the
 * ones TypeScript erases, without a bundler. Specs and test fixtures
 * (`src/test/**`, `*.spec.*`, `*.test.*`) stay out of the public-entry scan so
 * they can reach internals directly.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FEATURES_DIR = join(SRC_DIR, 'features')
const APP_DIR = join(SRC_DIR, 'app')
const TEST_DIR = join(SRC_DIR, 'test')

const SOURCE_EXTENSIONS = ['.ts', '.tsx']
const SOURCE_EXTENSION_SET = new Set(SOURCE_EXTENSIONS)
const TEST_FILE_PATTERN = /\.(spec|test)\.[^.]+$/

/** Path inside a capability that counts as its public interface. */
// `skeleton` is the light entry point the loading states render, so the page is
// never pulled into a loading chunk. `page` is the page's own entry point; the
// barrel exports only commands, so the page is never reached through it.
const PUBLIC_ENTRY_POINTS = new Set(['', 'index', 'skeleton', 'page'])

function toPosix(path: string): string {
  return path.split(sep).join('/')
}

function listSourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...listSourceFiles(path))
    else if (SOURCE_EXTENSION_SET.has(path.slice(path.lastIndexOf('.')))) files.push(path)
  }
  return files
}

/** Test-only modules may import capability internals directly. */
function isTestFile(file: string): boolean {
  return file.startsWith(`${TEST_DIR}${sep}`) || TEST_FILE_PATTERN.test(file)
}

function importSpecifiers(source: string): string[] {
  const specifiers = new Set<string>()
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) specifiers.add(match[1])
    }
  }
  return [...specifiers]
}

/** The capability a file belongs to, or null when it lives outside features/. */
function featureName(file: string): string | null {
  const rel = toPosix(relative(FEATURES_DIR, file))
  if (rel.startsWith('..')) return null
  return rel.split('/')[0] ?? null
}

interface CrossCapabilityImport {
  from: string
  to: string
  /** Path of the target inside its capability, without an extension. */
  entry: string
}

/**
 * Every import of `file` that lands inside a different capability, with the
 * entry point the importer used.
 */
function crossCapabilityImports(file: string, from: string): CrossCapabilityImport[] {
  const imports: CrossCapabilityImport[] = []
  const sourceFeature = featureName(file)

  for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
    const target = resolveImport(file, specifier)
    if (!target) continue

    const targetFeature = featureName(target)
    if (!targetFeature || targetFeature === sourceFeature) continue

    const entryPath = toPosix(relative(join(FEATURES_DIR, targetFeature), target))
    const extension = SOURCE_EXTENSIONS.find((candidate) => entryPath.endsWith(candidate))

    imports.push({
      from,
      to: targetFeature,
      entry: extension ? entryPath.slice(0, -extension.length) : entryPath,
    })
  }

  return imports
}

/**
 * Resolves a specifier to a real source file, honoring the `@/` alias and the
 * extensionless/index conventions TypeScript and Vite accept.
 */
function resolveImport(fromFile: string, specifier: string): string | null {
  let target: string | null = null
  if (specifier.startsWith('@/')) target = join(SRC_DIR, specifier.slice(2))
  else if (specifier.startsWith('.')) target = resolve(dirname(fromFile), specifier)
  if (!target) return null

  const candidates = [
    target,
    ...SOURCE_EXTENSIONS.map((extension) => `${target}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(target, `index${extension}`)),
  ]
  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
  )
}

function findCycle(graph: Map<string, Set<string>>): string[] | null {
  const visited = new Set<string>()
  const inPath = new Set<string>()
  const path: string[] = []
  let cycle: string[] | null = null

  const visit = (node: string): boolean => {
    if (inPath.has(node)) {
      cycle = [...path, node]
      return true
    }
    if (visited.has(node)) return false

    visited.add(node)
    inPath.add(node)
    path.push(node)
    for (const next of graph.get(node) ?? []) {
      if (visit(next)) return true
    }
    inPath.delete(node)
    path.pop()
    return false
  }

  for (const node of graph.keys()) {
    if (visit(node)) break
  }
  return cycle
}

const featureFiles = listSourceFiles(FEATURES_DIR)
const scannedFiles = listSourceFiles(SRC_DIR).filter((file) => !isTestFile(file))

describe('capability boundaries', () => {
  it('scans the migrated capability inventory', () => {
    const features = [...new Set(featureFiles.map(featureName))].filter(
      (name): name is string => name !== null
    )

    expect(features).toEqual(
      expect.arrayContaining([
        'squad-board',
        'games',
        'lobby',
        'my-squads',
        'squad-creation',
        'squad-joining',
        'squad-list',
      ])
    )
  })

  it('has no import cycles between capability modules', () => {
    // Cycles are checked between modules (files), not between capabilities. "No
    // cycle" guarantees that no module can reach itself by following imports, so
    // module evaluation order stays well-defined. There is no exception: the
    // Squad Board's barrel exports only its cache commands, so squad creation,
    // joining and the lobby refresh the board without reaching its page.
    const scopedFiles = new Set([...featureFiles, ...listSourceFiles(APP_DIR)])
    const graph = new Map<string, Set<string>>()

    for (const file of scopedFiles) {
      const edges = new Set<string>()
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        const target = resolveImport(file, specifier)
        if (target && scopedFiles.has(target)) edges.add(target)
      }
      graph.set(file, edges)
    }

    const cycle = findCycle(graph)
    const readableCycle = cycle?.map((file) => toPosix(relative(SRC_DIR, file)))

    expect(readableCycle ?? null).toBeNull()
  })

  it('only reaches another capability through its public entry point', () => {
    const violations: string[] = []

    for (const file of scannedFiles) {
      const from = toPosix(relative(SRC_DIR, file))
      for (const { to, entry } of crossCapabilityImports(file, from)) {
        if (!PUBLIC_ENTRY_POINTS.has(entry)) {
          violations.push(`${from} imports "${to}/${entry}"`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('keeps App Router pages on the public capability interfaces', () => {
    const violations: string[] = []

    for (const file of listSourceFiles(APP_DIR)) {
      const page = toPosix(relative(SRC_DIR, file))
      for (const { to, entry } of crossCapabilityImports(file, page)) {
        if (!PUBLIC_ENTRY_POINTS.has(entry)) {
          violations.push(`${page} imports "${to}/${entry}"`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
