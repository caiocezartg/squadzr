import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import type { CatalogImportSummary } from '@application/use-cases/game/catalog-import.use-case'
import { runCatalogImport, type CatalogImportLogger } from '@interface/catalog/catalog-import-entry'
import { createCandidate, FakeGameCatalogSource } from '@test/harness/game-catalog-source'
import { FakeClock } from '@test/harness/clock'
import {
  createIsolatedDatabase,
  type IsolatedDatabase,
  type PostgresHarnessContext,
} from '@test/harness/postgres'

// #122: every Catalog Import run is recorded as a Catalog Import Run. The cron entry claims the slot as
// `scheduled`, records the outcome in statements outside the import's transaction, and skips quietly
// while another run holds the slot. A fake source and a fixed clock keep every instant exact.

const { Client } = pg

const NOW = new Date('2026-11-05T04:00:00.000Z')
const MINUTE = 60_000

interface RunRow {
  id: string
  trigger: string
  requested_by_id: string | null
  status: string
  requested_at: Date
  started_at: Date | null
  finished_at: Date | null
  heartbeat_at: Date | null
  created: number | null
  updated: number | null
  delisted: number | null
  relisted: number | null
  received: number | null
  dropped: number | null
  invalid: number | null
  listed_games: number | null
  error_message: string | null
}

let context: PostgresHarnessContext
let database: IsolatedDatabase
let client: pg.Client
let source: FakeGameCatalogSource
let clock: FakeClock

beforeEach(async () => {
  context = inject('postgres')
  database = await createIsolatedDatabase(context)
  client = new Client({ connectionString: database.url })
  await client.connect()
  source = new FakeGameCatalogSource()
  clock = new FakeClock(NOW)
})

afterEach(async () => {
  await client.end()
  await database.drop()
})

function captureLogger(): {
  logger: CatalogImportLogger
  summaries: CatalogImportSummary[]
  errors: unknown[]
  skipped: number[]
} {
  const summaries: CatalogImportSummary[] = []
  const errors: unknown[] = []
  const skipped: number[] = []

  return {
    summaries,
    errors,
    skipped,
    logger: {
      info: (summary) => summaries.push(summary),
      skipped: () => skipped.push(1),
      error: (error) => errors.push(error),
    },
  }
}

function candidates(count: number, firstId = 7000) {
  return Array.from({ length: count }, (_, index) => {
    const igdbId = firstId + index
    return createCandidate({ igdbId, name: `Game ${igdbId}`, slug: `game-${igdbId}` })
  })
}

async function runs(): Promise<RunRow[]> {
  const { rows } = await client.query<RunRow>(
    'SELECT * FROM "catalog_import_runs" ORDER BY "requested_at", "id"'
  )
  return rows
}

async function insertRun(
  status: string,
  times: { requestedAt: Date; heartbeatAt?: Date | null; startedAt?: Date | null }
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO "catalog_import_runs" ("trigger", "status", "requested_at", "started_at", "heartbeat_at")
     VALUES ('manual', $1, $2, $3, $4) RETURNING "id"`,
    [status, times.requestedAt, times.startedAt ?? null, times.heartbeatAt ?? null]
  )
  return rows[0]?.id ?? ''
}

/** Runs the cron once, then moves the clock on so the next run has a later request instant. */
async function run(overrides: {
  overrideFractionCheck?: boolean
  logger: CatalogImportLogger
}): Promise<number> {
  const exitCode = await runCatalogImport({
    databaseUrl: database.url,
    source,
    clock,
    ...overrides,
  })
  clock.advance(MINUTE)
  return exitCode
}

describe('a cron run against the database', () => {
  it('records one scheduled run that succeeded with the counts and the Listed Games count', async () => {
    source.withCandidates(candidates(12)).withInvalid(2)
    const recorded = captureLogger()

    const exitCode = await run({ logger: recorded.logger })

    expect(exitCode).toBe(0)
    const [only, ...others] = await runs()
    expect(others).toHaveLength(0)
    expect(only).toMatchObject({
      trigger: 'scheduled',
      requested_by_id: null,
      status: 'succeeded',
      created: 12,
      updated: 0,
      delisted: 0,
      relisted: 0,
      received: 12,
      dropped: 0,
      invalid: 2,
      listed_games: 12,
      error_message: null,
    })
    expect(only?.requested_at).toEqual(NOW)
    expect(only?.started_at).toEqual(NOW)
    expect(only?.finished_at).toEqual(NOW)
    expect(only?.heartbeat_at).toEqual(NOW)
  })

  it('records a safety stop even though the import rolled back, and exits 1', async () => {
    source.withCandidates(candidates(12))
    await run({ logger: captureLogger().logger })
    source.withCandidates(candidates(3))
    const recorded = captureLogger()

    const exitCode = await run({ logger: recorded.logger })

    expect(exitCode).toBe(1)
    expect(recorded.errors).toHaveLength(1)
    const stopped = (await runs()).at(-1)
    expect(stopped).toMatchObject({
      trigger: 'scheduled',
      status: 'safety_stop',
      created: null,
      listed_games: 12,
    })
    expect(stopped?.error_message).toContain('below the absolute floor')
  })

  it('records a failure with its message, and exits 1', async () => {
    source.failWith(new Error('IGDB is unavailable'))
    const recorded = captureLogger()

    const exitCode = await run({ logger: recorded.logger })

    expect(exitCode).toBe(1)
    expect(recorded.errors).toHaveLength(1)
    expect(await runs()).toMatchObject([
      {
        status: 'failed',
        error_message: 'IGDB is unavailable',
        listed_games: 0,
        created: null,
      },
    ])
  })

  it('keeps the fraction-check override working for the cron', async () => {
    source.withCandidates(candidates(40))
    await run({ logger: captureLogger().logger })
    source.withCandidates(candidates(12))

    const blocked = await run({ logger: captureLogger().logger })
    const allowed = await run({ overrideFractionCheck: true, logger: captureLogger().logger })

    expect(blocked).toBe(1)
    expect(allowed).toBe(0)
    expect((await runs()).map((row) => row.status)).toEqual([
      'succeeded',
      'safety_stop',
      'succeeded',
    ])
  })

  it('logs, exits 0 and records nothing while a run holds the slot', async () => {
    source.withCandidates(candidates(12))
    await insertRun('running', {
      requestedAt: new Date(NOW.getTime() - MINUTE),
      startedAt: new Date(NOW.getTime() - MINUTE),
      heartbeatAt: new Date(NOW.getTime() - MINUTE),
    })
    const recorded = captureLogger()

    const exitCode = await run({ logger: recorded.logger })

    expect(exitCode).toBe(0)
    expect(recorded.skipped).toHaveLength(1)
    expect(recorded.errors).toHaveLength(0)
    expect(source.calls).toBe(0)
    expect(await runs()).toHaveLength(1)
  })

  it('logs, exits 0 and records nothing while a requested run is waiting', async () => {
    source.withCandidates(candidates(12))
    await insertRun('requested', { requestedAt: new Date(NOW.getTime() - 5 * MINUTE) })
    const recorded = captureLogger()

    const exitCode = await run({ logger: recorded.logger })

    expect(exitCode).toBe(0)
    expect(recorded.skipped).toHaveLength(1)
    expect(source.calls).toBe(0)
    expect(await runs()).toHaveLength(1)
  })

  it('marks a running run silent for over 2 minutes interrupted and runs in its place', async () => {
    source.withCandidates(candidates(12))
    const staleId = await insertRun('running', {
      requestedAt: new Date(NOW.getTime() - 10 * MINUTE),
      startedAt: new Date(NOW.getTime() - 10 * MINUTE),
      heartbeatAt: new Date(NOW.getTime() - 2 * MINUTE - 1),
    })

    const exitCode = await run({ logger: captureLogger().logger })

    expect(exitCode).toBe(0)
    const rows = await runs()
    expect(rows.find((row) => row.id === staleId)).toMatchObject({
      status: 'interrupted',
      finished_at: NOW,
    })
    expect(rows.at(-1)).toMatchObject({ trigger: 'scheduled', status: 'succeeded' })
  })

  it('marks a requested run unclaimed for over 10 minutes interrupted and runs in its place', async () => {
    source.withCandidates(candidates(12))
    const staleId = await insertRun('requested', {
      requestedAt: new Date(NOW.getTime() - 10 * MINUTE - 1),
    })

    const exitCode = await run({ logger: captureLogger().logger })

    expect(exitCode).toBe(0)
    const rows = await runs()
    expect(rows.find((row) => row.id === staleId)?.status).toBe('interrupted')
    expect(rows.at(-1)).toMatchObject({ trigger: 'scheduled', status: 'succeeded' })
  })

  it('keeps a running run whose heartbeat is exactly 2 minutes old', async () => {
    source.withCandidates(candidates(12))
    await insertRun('running', {
      requestedAt: new Date(NOW.getTime() - 5 * MINUTE),
      startedAt: new Date(NOW.getTime() - 5 * MINUTE),
      heartbeatAt: new Date(NOW.getTime() - 2 * MINUTE),
    })
    const recorded = captureLogger()

    const exitCode = await run({ logger: recorded.logger })

    expect(exitCode).toBe(0)
    expect(recorded.skipped).toHaveLength(1)
    expect((await runs()).map((row) => row.status)).toEqual(['running'])
  })

  it('allows only one requested or running run at a time', async () => {
    await insertRun('running', { requestedAt: NOW, heartbeatAt: NOW, startedAt: NOW })

    await expect(insertRun('requested', { requestedAt: NOW })).rejects.toMatchObject({
      code: '23505',
    })
    await expect(insertRun('running', { requestedAt: NOW })).rejects.toMatchObject({
      code: '23505',
    })
    await expect(insertRun('failed', { requestedAt: NOW })).resolves.toEqual(expect.any(String))
  })
})
