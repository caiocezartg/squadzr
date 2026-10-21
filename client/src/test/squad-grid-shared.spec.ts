/**
 * The squad surfaces share one grid and one games map (CCC-81). The Squad Board and My Squads
 * render their cards through `SquadGrid`, and the games map is built only by the games capability's
 * hook, so the two pages cannot drift into separate card compositions or lookups.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TEST_FILE_PATTERN = /\.(spec|test)\.[^.]+$/

function toPosix(path: string): string {
  return path.split(sep).join('/')
}

function read(path: string): string {
  return readFileSync(resolve(SRC_DIR, path), 'utf8')
}

function sourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(path))
    else if (/\.(ts|tsx)$/.test(path)) files.push(path)
  }
  return files
}

describe('shared squad surfaces', () => {
  it('renders the Squad Board and My Squads cards through the same grid', () => {
    const board = read('features/squad-board/squad-board-results.tsx')
    const mySquads = read('features/my-squads/my-squads-results.tsx')

    for (const source of [board, mySquads]) {
      expect(source).toContain('SquadGrid')
      expect(source).not.toContain('<SquadCard')
    }
    expect(read('features/squad-list/squad-grid.tsx')).toContain('<SquadCard')
  })

  it('builds the games map in one place', () => {
    const builders = sourceFiles(SRC_DIR)
      .filter((file) => !TEST_FILE_PATTERN.test(file) && !toPosix(file).includes('/test/'))
      .filter((file) => readFileSync(file, 'utf8').includes('new Map(games.map'))
      .map((file) => toPosix(relative(SRC_DIR, file)))

    expect(builders).toEqual(['features/games/use-games-map.ts'])
  })
})
