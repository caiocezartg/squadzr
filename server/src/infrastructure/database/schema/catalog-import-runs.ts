import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import {
  ACTIVE_CATALOG_IMPORT_RUN_STATUSES,
  CATALOG_IMPORT_RUN_STATUSES,
  CATALOG_IMPORT_RUN_TRIGGERS,
  type CatalogImportRunStatus,
  type CatalogImportRunTrigger,
} from '@squadzr/schemas'
import { user } from './auth'

// A Catalog Import Run is the record of one execution of the Catalog Import. The requesting admin
// keeps a name snapshot and loses only the reference when their account is deleted. Every write to a
// run is its own statement, never part of the import's transaction, so a rollback keeps the outcome.
// The counts are set together when a run succeeds and stay null otherwise.
export const catalogImportRuns = pgTable(
  'catalog_import_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trigger: varchar('trigger', { length: 20 }).$type<CatalogImportRunTrigger>().notNull(),
    requestedById: text('requested_by_id').references(() => user.id, { onDelete: 'set null' }),
    requestedByName: text('requested_by_name'),
    status: varchar('status', { length: 20 }).$type<CatalogImportRunStatus>().notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
    created: integer('created'),
    updated: integer('updated'),
    delisted: integer('delisted'),
    relisted: integer('relisted'),
    received: integer('received'),
    dropped: integer('dropped'),
    invalid: integer('invalid'),
    listedGames: integer('listed_games'),
    errorMessage: text('error_message'),
  },
  (table) => ({
    triggerInEnum: check(
      'catalog_import_runs_trigger_in_enum',
      sql`${table.trigger} IN (${sql.raw(CATALOG_IMPORT_RUN_TRIGGERS.map((value) => `'${value}'`).join(', '))})`
    ),
    statusInEnum: check(
      'catalog_import_runs_status_in_enum',
      sql`${table.status} IN (${sql.raw(CATALOG_IMPORT_RUN_STATUSES.map((value) => `'${value}'`).join(', '))})`
    ),
    // One slot: every active row indexes the same constant, so a second `requested` or `running` row
    // collides and the claim loses.
    singleActiveRun: uniqueIndex('catalog_import_runs_single_active_idx')
      .on(sql`(true)`)
      .where(
        sql`${table.status} IN (${sql.raw(ACTIVE_CATALOG_IMPORT_RUN_STATUSES.map((value) => `'${value}'`).join(', '))})`
      ),
    requestedAtIdx: index('catalog_import_runs_requested_at_idx').on(
      table.requestedAt.desc(),
      table.id.desc()
    ),
  })
)

export type CatalogImportRunRow = typeof catalogImportRuns.$inferSelect
export type NewCatalogImportRunRow = typeof catalogImportRuns.$inferInsert
