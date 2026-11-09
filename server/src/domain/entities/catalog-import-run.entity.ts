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
