/**
 * Capability boundary enforcement (CCC-42).
 *
 * Client code is organized by capability (docs/adr/0001): each
 * `src/features/<capability>` keeps its query keys, realtime names and
 * presentation internal and exposes a small public interface. This test walks
 * the real source tree and enforces two structural rules:
 *
 * - there are no import cycles between capability modules (the command-only
 *   `commands.ts` entry exists exactly to keep the module graph acyclic while
 *   the catalog page composes create/join/lobby);
 * - capabilities and TanStack routes only reach another capability through a
 *   public entry point (`index.ts`, plus the documented `commands.ts`).
 *
 * The scan is source-level on purpose: it sees every specifier, including the
 * ones TypeScript erases, without a bundler.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FEATURES_DIR = join(SRC_DIR, 'features')
const ROUTES_DIR = join(SRC_DIR, 'routes')

const SOURCE_EXTENSIONS = ['.ts', '.tsx']
const SOURCE_EXTENSION_SET = new Set(SOURCE_EXTENSIONS)

/** Path inside a capability that counts as its public interface. */
const PUBLIC_ENTRY_POINTS = new Set(['', 'index', 'commands'])

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

describe('capability boundaries', () => {
  it('scans the migrated capability inventory', () => {
    const features = [...new Set(featureFiles.map(featureName))].filter(
      (name): name is string => name !== null
    )

    expect(features).toEqual(
      expect.arrayContaining([
        'catalog',
        'games',
        'lobby',
        'my-rooms',
        'room-creation',
        'room-joining',
        'room-list',
      ])
    )
  })

  it('has no import cycles between capability modules', () => {
    const scopedFiles = new Set([...featureFiles, ...listSourceFiles(ROUTES_DIR)])
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

    for (const file of featureFiles) {
      const feature = featureName(file)
      if (!feature) continue
      for (const { to, entry } of crossCapabilityImports(file, feature)) {
        if (!PUBLIC_ENTRY_POINTS.has(entry)) {
          violations.push(`${toPosix(relative(SRC_DIR, file))} imports "${to}/${entry}"`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('keeps routes on the public capability interfaces', () => {
    const violations: string[] = []

    for (const file of listSourceFiles(ROUTES_DIR)) {
      const route = toPosix(relative(SRC_DIR, file))
      for (const { to, entry } of crossCapabilityImports(file, route)) {
        if (!PUBLIC_ENTRY_POINTS.has(entry)) {
          violations.push(`${route} imports "${to}/${entry}"`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
