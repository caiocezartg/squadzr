import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { games } from '@infrastructure/database/schema'
import { GAMES_DATA } from '@infrastructure/database/seed/games.seed'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-61: the games seed runs as a process of its own. With DATABASE_URL as its only
// configuration it leaves the catalog in PostgreSQL, and a second run upserts the same
// catalog instead of duplicating it.

const SERVER_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SEED_ENTRY = 'src/interface/scripts/games.seed.ts'
// Operating-system variables a Bun process needs to start, on Windows and on POSIX.
const OS_VARIABLES = ['PATH', 'SYSTEMROOT', 'USERPROFILE', 'HOME', 'TEMP', 'TMP', 'TMPDIR']

let server: TestServer

beforeEach(async () => {
  server = await buildTestServer()
})

afterEach(async () => {
  await server.close()
})

interface SeedRun {
  exitCode: number | null
  stdout: string
  stderr: string
}

/** The seed's environment: DATABASE_URL and the OS basics, nothing else from the server's configuration. */
function seedEnvironment(): Record<string, string> {
  const env: Record<string, string> = { DATABASE_URL: server.databaseUrl }
  for (const name of OS_VARIABLES) {
    const value = process.env[name]
    if (value !== undefined) env[name] = value
  }
  return env
}

/** Runs the seed entry in a child process, with `--no-env-file` so no local .env file adds variables. */
function runSeed(): Promise<SeedRun> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['--no-env-file', SEED_ENTRY], {
      cwd: SERVER_ROOT,
      env: seedEnvironment(),
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    child.once('error', reject)
    child.once('close', (exitCode) => resolve({ exitCode, stdout, stderr }))
  })
}

const bySlug = (a: { slug: string }, b: { slug: string }) => a.slug.localeCompare(b.slug)
const EXPECTED_CATALOG = [...GAMES_DATA].sort(bySlug)

async function persistedCatalog() {
  const rows = await server.app.db
    .select({
      name: games.name,
      slug: games.slug,
      coverUrl: games.coverUrl,
      minPlayers: games.minPlayers,
      maxPlayers: games.maxPlayers,
    })
    .from(games)
  return rows.sort(bySlug)
}

describe('games seed process', () => {
  it('persists the catalog when DATABASE_URL is its only configuration', async () => {
    const run = await runSeed()

    expect(run.exitCode, run.stderr).toBe(0)
    expect(run.stdout).toContain('Done seeding games!')
    expect(await persistedCatalog()).toEqual(EXPECTED_CATALOG)
  })

  it('upserts the same catalog on a second run instead of duplicating it', async () => {
    await runSeed()
    const again = await runSeed()

    expect(again.exitCode, again.stderr).toBe(0)
    expect(await persistedCatalog()).toEqual(EXPECTED_CATALOG)
  })
})
