import { ACTIVE_CATALOG_IMPORT_RUN_STATUSES, type CatalogImportRunStatus } from '@squadzr/schemas'
import { and, asc, count, desc, eq, gt, inArray, isNotNull, lt, max, or, sql } from 'drizzle-orm'
import type {
  CatalogImportRun,
  CatalogImportRunOutcome,
  ClaimCatalogImportRunInput,
  RequestManualCatalogImportRunInput,
  RequestManualCatalogImportRunOutcome,
} from '@domain/entities/catalog-import-run.entity'
import type {
  CatalogImportRunStaleness,
  ICatalogImportRunRepository,
} from '@domain/repositories/catalog-import-run.repository'
import type { Database } from '@infrastructure/database/drizzle'
import {
  catalogImportRuns,
  type CatalogImportRunRow,
} from '@infrastructure/database/schema/catalog-import-runs'
import { insertAuditEntry } from './audit-entry-writer'

/** The terminal statuses: a run in one of them has stopped and has a `finished_at`. */
const FINISHED_STATUSES: CatalogImportRunStatus[] = [
  'succeeded',
  'safety_stop',
  'failed',
  'interrupted',
]

function mapRowToEntity(row: CatalogImportRunRow): CatalogImportRun {
  const hasSummary =
    row.status === 'succeeded' &&
    row.created !== null &&
    row.updated !== null &&
    row.delisted !== null &&
    row.relisted !== null &&
    row.received !== null &&
    row.dropped !== null &&
    row.invalid !== null

  return {
    id: row.id,
    trigger: row.trigger,
    requestedBy:
      row.requestedByName === null ? null : { id: row.requestedById, name: row.requestedByName },
    status: row.status,
    requestedAt: row.requestedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    heartbeatAt: row.heartbeatAt,
    summary: hasSummary
      ? {
          created: row.created ?? 0,
          updated: row.updated ?? 0,
          delisted: row.delisted ?? 0,
          relisted: row.relisted ?? 0,
          received: row.received ?? 0,
          dropped: row.dropped ?? 0,
          invalid: row.invalid ?? 0,
        }
      : null,
    listedGames: row.listedGames,
    errorMessage: row.errorMessage,
  }
}

export class DrizzleCatalogImportRunRepository implements ICatalogImportRunRepository {
  constructor(private readonly db: Database) {}

  async interruptStale(staleness: CatalogImportRunStaleness, now: Date): Promise<number> {
    const rows = await this.db
      .update(catalogImportRuns)
      .set({ status: 'interrupted', finishedAt: now })
      .where(
        or(
          and(
            eq(catalogImportRuns.status, 'running'),
            lt(
              sql`coalesce(${catalogImportRuns.heartbeatAt}, ${catalogImportRuns.startedAt}, ${catalogImportRuns.requestedAt})`,
              staleness.heartbeatBefore
            )
          ),
          and(
            eq(catalogImportRuns.status, 'requested'),
            lt(catalogImportRuns.requestedAt, staleness.requestedBefore)
          )
        )
      )
      .returning({ id: catalogImportRuns.id })

    return rows.length
  }

  async claim(input: ClaimCatalogImportRunInput): Promise<CatalogImportRun | null> {
    const rows = await this.db
      .insert(catalogImportRuns)
      .values({
        trigger: input.trigger,
        requestedById: input.requestedBy?.id ?? null,
        requestedByName: input.requestedBy?.name ?? null,
        status: 'running',
        requestedAt: input.now,
        startedAt: input.now,
        heartbeatAt: input.now,
      })
      .onConflictDoNothing()
      .returning()

    const row = rows[0]
    return row ? mapRowToEntity(row) : null
  }

  async requestManual(
    input: RequestManualCatalogImportRunInput
  ): Promise<RequestManualCatalogImportRunOutcome> {
    return this.db.transaction(async (tx) => {
      // A run holding the slot answers first, so a request while a run is active is always `slot_taken`,
      // also when that run is the manual one that started the 24 hour window.
      const active = await tx
        .select({ id: catalogImportRuns.id })
        .from(catalogImportRuns)
        .where(inArray(catalogImportRuns.status, [...ACTIVE_CATALOG_IMPORT_RUN_STATUSES]))
        .limit(1)
      if (active.length > 0) return { status: 'slot_taken' }

      const latest = await tx
        .select({ lastRequestedAt: max(catalogImportRuns.requestedAt) })
        .from(catalogImportRuns)
        .where(
          and(
            eq(catalogImportRuns.trigger, 'manual'),
            gt(catalogImportRuns.requestedAt, input.requestedAfter)
          )
        )
      const lastRequestedAt = latest[0]?.lastRequestedAt
      if (lastRequestedAt) return { status: 'limit', lastRequestedAt }

      // The slot is still the partial unique index's to give: a simultaneous request that passed the
      // checks above meets the index here and queues nothing.
      const rows = await tx
        .insert(catalogImportRuns)
        .values({
          trigger: 'manual',
          requestedById: input.requestedBy.id,
          requestedByName: input.requestedBy.name,
          status: 'requested',
          requestedAt: input.now,
        })
        .onConflictDoNothing()
        .returning()

      const row = rows[0]
      if (!row) return { status: 'slot_taken' }

      const run = mapRowToEntity(row)
      await insertAuditEntry(tx, input.buildAuditEntry(run, input.now))
      return { status: 'requested', run }
    })
  }

  async claimRequested(now: Date): Promise<CatalogImportRun | null> {
    const oldestRequested = this.db
      .select({ id: catalogImportRuns.id })
      .from(catalogImportRuns)
      .where(eq(catalogImportRuns.status, 'requested'))
      .orderBy(asc(catalogImportRuns.requestedAt), asc(catalogImportRuns.id))
      .limit(1)
      .for('update', { skipLocked: true })

    // One statement: the row moves to `running` only while it is still `requested`, so of two
    // executors racing for it exactly one gets a row back.
    const rows = await this.db
      .update(catalogImportRuns)
      .set({ status: 'running', startedAt: now, heartbeatAt: now })
      .where(
        and(
          eq(catalogImportRuns.status, 'requested'),
          inArray(catalogImportRuns.id, oldestRequested)
        )
      )
      .returning()

    const row = rows[0]
    return row ? mapRowToEntity(row) : null
  }

  async heartbeat(id: string, now: Date): Promise<void> {
    await this.db
      .update(catalogImportRuns)
      .set({ heartbeatAt: now })
      .where(and(eq(catalogImportRuns.id, id), eq(catalogImportRuns.status, 'running')))
  }

  async finish(id: string, outcome: CatalogImportRunOutcome, now: Date): Promise<void> {
    const common = { status: outcome.status, finishedAt: now, listedGames: outcome.listedGames }
    const values =
      outcome.status === 'succeeded'
        ? { ...common, ...outcome.summary, errorMessage: null }
        : { ...common, errorMessage: outcome.errorMessage }

    await this.db
      .update(catalogImportRuns)
      .set(values)
      .where(and(eq(catalogImportRuns.id, id), eq(catalogImportRuns.status, 'running')))
  }

  async list(offset: number, limit: number): Promise<{ runs: CatalogImportRun[]; total: number }> {
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(catalogImportRuns)
        .orderBy(desc(catalogImportRuns.requestedAt), desc(catalogImportRuns.id))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(catalogImportRuns),
    ])

    return { runs: rows.map(mapRowToEntity), total: totals[0]?.total ?? 0 }
  }

  async findActive(): Promise<CatalogImportRun | null> {
    const rows = await this.db
      .select()
      .from(catalogImportRuns)
      .where(inArray(catalogImportRuns.status, [...ACTIVE_CATALOG_IMPORT_RUN_STATUSES]))
      .limit(1)

    const row = rows[0]
    return row ? mapRowToEntity(row) : null
  }

  async findLatestManualRequestedAt(): Promise<Date | null> {
    const rows = await this.db
      .select({ lastRequestedAt: max(catalogImportRuns.requestedAt) })
      .from(catalogImportRuns)
      .where(eq(catalogImportRuns.trigger, 'manual'))

    return rows[0]?.lastRequestedAt ?? null
  }

  async findLatest(): Promise<CatalogImportRun | null> {
    const rows = await this.db
      .select()
      .from(catalogImportRuns)
      .orderBy(desc(catalogImportRuns.requestedAt), desc(catalogImportRuns.id))
      .limit(1)

    const row = rows[0]
    return row ? mapRowToEntity(row) : null
  }

  async findLatestFinished(): Promise<CatalogImportRun | null> {
    const rows = await this.db
      .select()
      .from(catalogImportRuns)
      .where(
        and(
          inArray(catalogImportRuns.status, FINISHED_STATUSES),
          isNotNull(catalogImportRuns.finishedAt)
        )
      )
      .orderBy(desc(catalogImportRuns.finishedAt), desc(catalogImportRuns.id))
      .limit(1)

    const row = rows[0]
    return row ? mapRowToEntity(row) : null
  }
}
