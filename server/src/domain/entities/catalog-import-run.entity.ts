import type { NewAuditEntry } from './audit-entry.entity'
import type {
  CatalogImportRunStatus,
  CatalogImportRunSummaryDto,
  CatalogImportRunTrigger,
} from '@squadzr/schemas'

/**
 * The record of one Catalog Import. `requestedBy` is the admin who asked for a manual run (null for a
 * scheduled one); its id is null once the admin's account is gone. The summary exists only for a
 * succeeded run; `listedGames` is the Listed Games count read after the run.
 */
export interface CatalogImportRun {
  readonly id: string
  readonly trigger: CatalogImportRunTrigger
  readonly requestedBy: { readonly id: string | null; readonly name: string } | null
  readonly status: CatalogImportRunStatus
  readonly requestedAt: Date
  readonly startedAt: Date | null
  readonly finishedAt: Date | null
  readonly heartbeatAt: Date | null
  readonly summary: CatalogImportRunSummaryDto | null
  readonly listedGames: number | null
  readonly errorMessage: string | null
}

/** The statuses a run ends in, with what each one records. */
export type CatalogImportRunOutcome =
  | {
      readonly status: 'succeeded'
      readonly summary: CatalogImportRunSummaryDto
      readonly listedGames: number | null
    }
  | {
      readonly status: 'safety_stop' | 'failed'
      readonly errorMessage: string
      readonly listedGames: number | null
    }

export interface ClaimCatalogImportRunInput {
  readonly trigger: CatalogImportRunTrigger
  readonly requestedBy: { readonly id: string; readonly name: string } | null
  readonly now: Date
}

export interface RequestManualCatalogImportRunInput {
  readonly requestedBy: { readonly id: string; readonly name: string }
  readonly now: Date
  /** A manual run requested after this instant refuses the request. */
  readonly requestedAfter: Date
  /** The `catalog_import_requested` Audit Entry, written with the run in the same transaction. */
  readonly buildAuditEntry: (run: CatalogImportRun, requestedAt: Date) => NewAuditEntry
}

/** How asking for a manual run ended; only `requested` queued a run. */
export type RequestManualCatalogImportRunOutcome =
  | { readonly status: 'requested'; readonly run: CatalogImportRun }
  /** A manual run was already requested inside the window, whatever became of it. */
  | { readonly status: 'limit'; readonly lastRequestedAt: Date }
  /** Another run is `requested` or `running`: the partial unique index refused the insert. */
  | { readonly status: 'slot_taken' }
