import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import type { CatalogImportSummary } from '@application/use-cases/game/catalog-import.use-case'
import { runCatalogImport, type CatalogImportLogger } from '@interface/catalog/catalog-import-entry'
import { createCandidate, FakeGameCatalogSource } from '@test/harness/game-catalog-source'
import {
  createIsolatedDatabase,
  type IsolatedDatabase,
  type PostgresHarnessContext,
} from '@test/harness/postgres'

// CCC-89: the Catalog Import entry owns the pool and the exit code. It logs one
// structured summary on success, reports failure as exit code 1, and always
// closes the pool; no child process is involved.

const { Client } = pg

let context: PostgresHarnessContext
let database: IsolatedDatabase
let admin: pg.Client
let source: FakeGameCatalogSource

beforeEach(async () => {
  context = inject('postgres')
  database = await createIsolatedDatabase(context)
  admin = new Client({ connectionString: context.adminUrl })
  await admin.connect()
  source = new FakeGameCatalogSource()
})

afterEach(async () => {
  await admin.end()
  await database.drop()
})

function captureLogger(): {
  logger: CatalogImportLogger
  summaries: CatalogImportSummary[]
  errors: unknown[]
} {
  const summaries: CatalogImportSummary[] = []
  const errors: unknown[] = []

  return {
    summaries,
    errors,
    logger: {
      info: (summary) => summaries.push(summary),
      error: (error) => errors.push(error),
    },
  }
}

function candidates(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const igdbId = 7000 + index
    return createCandidate({ igdbId, name: `Game ${igdbId}`, slug: `game-${igdbId}` })
  })
}

async function countGames(): Promise<number> {
  const client = new Client({ connectionString: database.url })
  await client.connect()
  try {
    const { rows } = await client.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM "games"'
    )
    return rows[0]?.total ?? 0
  } finally {
    await client.end()
  }
}

async function openConnections(): Promise<number> {
  const { rows } = await admin.query<{ total: number }>(
    'SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname = $1',
    [database.name]
  )
  return rows[0]?.total ?? 0
}

describe('runCatalogImport', () => {
  it('logs one summary, exits 0 and closes its pool after a successful run', async () => {
    source.withCandidates(candidates(12))
    const recorded = captureLogger()

    const exitCode = await runCatalogImport({
      databaseUrl: database.url,
      source,
      logger: recorded.logger,
    })

    expect(exitCode).toBe(0)
    expect(recorded.errors).toHaveLength(0)
    expect(recorded.summaries).toHaveLength(1)
    expect(recorded.summaries[0]).toMatchObject({
      created: 12,
      updated: 0,
      delisted: 0,
      relisted: 0,
      received: 12,
      dropped: 0,
    })
    expect(recorded.summaries[0]?.durationMs).toBeGreaterThanOrEqual(0)
    expect(source.calls).toBe(1)
    expect(await countGames()).toBe(12)
    expect(await openConnections()).toBe(0)
  })

  it('logs the failure, exits 1 and closes its pool when the source fails', async () => {
    source.failWith(new Error('IGDB is unavailable'))
    const recorded = captureLogger()

    const exitCode = await runCatalogImport({
      databaseUrl: database.url,
      source,
      logger: recorded.logger,
    })

    expect(exitCode).toBe(1)
    expect(recorded.summaries).toHaveLength(0)
    expect(recorded.errors).toHaveLength(1)
    expect(recorded.errors[0]).toMatchObject({ message: 'IGDB is unavailable' })
    expect(await countGames()).toBe(0)
    expect(await openConnections()).toBe(0)
  })
})
