import { z } from 'zod'
import { isoDateTimeSchema } from './date'
import { paginatedResponseSchema } from './pagination'

// The Catalog Import Run contracts (#122). A run is one recorded execution of the Catalog Import; the
// history lists them newest first and the Overview shows the last one.

/** Who started a run: the daily cron or an admin from the panel. */
export const CATALOG_IMPORT_RUN_TRIGGERS = ['scheduled', 'manual'] as const

export const catalogImportRunTriggerSchema = z.enum(CATALOG_IMPORT_RUN_TRIGGERS)

export type CatalogImportRunTrigger = z.infer<typeof catalogImportRunTriggerSchema>

/**
 * Where a run is: `requested` (queued, nobody claimed it yet), `running`, or finished as `succeeded`,
 * `safety_stop` (the import's own safety check refused to touch the catalog), `failed` or
 * `interrupted` (abandoned by a crash or a deploy).
 */
export const CATALOG_IMPORT_RUN_STATUSES = [
  'requested',
  'running',
  'succeeded',
  'safety_stop',
  'failed',
  'interrupted',
] as const

export const catalogImportRunStatusSchema = z.enum(CATALOG_IMPORT_RUN_STATUSES)

export type CatalogImportRunStatus = z.infer<typeof catalogImportRunStatusSchema>

/** The statuses that hold the single run slot: at most one run is in one of them at a time. */
export const ACTIVE_CATALOG_IMPORT_RUN_STATUSES = ['requested', 'running'] as const

const countSchema = z.number().int().nonnegative()

/** What a succeeded run changed. Only a succeeded run has one. */
export const catalogImportRunSummarySchema = z.object({
  created: countSchema,
  updated: countSchema,
  delisted: countSchema,
  relisted: countSchema,
  /** Candidates the source returned, duplicates included. */
  received: countSchema,
  /** Candidates ignored because their IGDB id repeated within the run. */
  dropped: countSchema,
  /** Candidates the source discarded because a required field was missing. */
  invalid: countSchema,
})

export type CatalogImportRunSummaryDto = z.infer<typeof catalogImportRunSummarySchema>

// `requestedBy` is the admin who asked for a manual run: null for a scheduled run, and its id is null
// once the admin's account is gone (the name stays). `listedGames` is the Listed Games count read after
// the run, also after a safety stop or a failure; it is null while the run has not finished and for an
// interrupted run.
export const catalogImportRunSchema = z.object({
  id: z.string(),
  trigger: catalogImportRunTriggerSchema,
  requestedBy: z.object({ id: z.string().nullable(), name: z.string() }).nullable(),
  status: catalogImportRunStatusSchema,
  requestedAt: isoDateTimeSchema,
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
  summary: catalogImportRunSummarySchema.nullable(),
  listedGames: countSchema.nullable(),
  errorMessage: z.string().nullable(),
})

export type CatalogImportRunDto = z.infer<typeof catalogImportRunSchema>

/** How long a manual run, once requested, keeps the next one away: every request counts, whatever its outcome. */
export const MANUAL_CATALOG_IMPORT_LIMIT_MS = 24 * 60 * 60 * 1000

/**
 * Whether an admin may request a manual run now: available, or the instant it becomes available (24 hours
 * after the last manual request). It says nothing about the run slot; `activeRun` carries that.
 */
export const manualCatalogImportAvailabilitySchema = z.discriminatedUnion('available', [
  z.object({ available: z.literal(true) }),
  z.object({ available: z.literal(false), availableAt: isoDateTimeSchema }),
])

export type ManualCatalogImportAvailability = z.infer<typeof manualCatalogImportAvailabilitySchema>

// The history page also carries what the Run import panel needs on any page: the manual-run
// availability and the run holding the slot (`requested` or `running`), null when none does.
export const catalogImportRunsResponseSchema = paginatedResponseSchema(
  catalogImportRunSchema
).extend({
  manualRun: manualCatalogImportAvailabilitySchema,
  activeRun: catalogImportRunSchema.nullable(),
})

/** The 202 of `POST /api/admin/catalog-import/runs`: the run that was queued. */
export const requestCatalogImportRunResponseSchema = catalogImportRunSchema

export type CatalogImportRunsResponse = z.infer<typeof catalogImportRunsResponseSchema>
