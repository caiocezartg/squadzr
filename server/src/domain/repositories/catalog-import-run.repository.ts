import type {
  CatalogImportRun,
  CatalogImportRunOutcome,
  ClaimCatalogImportRunInput,
  RequestManualCatalogImportRunInput,
  RequestManualCatalogImportRunOutcome,
} from '@domain/entities/catalog-import-run.entity'

/** How long a run may be silent before it counts as abandoned. */
export interface CatalogImportRunStaleness {
  /** A `running` run whose heartbeat is older than this instant is abandoned. */
  readonly heartbeatBefore: Date
  /**
   * A `requested` run nobody claimed since this instant is abandoned. Omitted: queued runs are never
   * abandoned, which is how the executor, the one claimer of queued runs, frees the slot.
   */
  readonly requestedBefore?: Date
}

/**
 * The Catalog Import Runs. Every method is one statement on the repository's own connection, never
 * part of the import's transaction, so a rollback of the import never erases a run or its outcome.
 */
export interface ICatalogImportRunRepository {
  /** Marks abandoned runs `interrupted` and frees the slot; returns how many it marked. */
  interruptStale(staleness: CatalogImportRunStaleness, now: Date): Promise<number>
  /**
   * Takes the single run slot as a `running` run. Null when another run is `requested` or `running`:
   * the partial unique index decides, so two simultaneous claims cannot both win.
   */
  claim(input: ClaimCatalogImportRunInput): Promise<CatalogImportRun | null>
  /**
   * Queues a manual run and its Audit Entry in one transaction. It refuses (`slot_taken`) while a run is
   * `requested` or `running`, and when the insert meets the partial unique index, so two simultaneous
   * requests cannot both queue; and (`limit`) when a manual run was requested after `requestedAfter`,
   * whatever its outcome.
   */
  requestManual(
    input: RequestManualCatalogImportRunInput
  ): Promise<RequestManualCatalogImportRunOutcome>
  /**
   * Starts the oldest `requested` run with one conditional update (`requested → running` only while
   * it is still `requested`), setting its start and heartbeat. Null when none is queued or another
   * executor took it first, so two executors never run the same row.
   */
  claimRequested(now: Date): Promise<CatalogImportRun | null>
  /** Proves a `running` run is alive. */
  heartbeat(id: string, now: Date): Promise<void>
  /** Ends a `running` run with its outcome. */
  finish(id: string, outcome: CatalogImportRunOutcome, now: Date): Promise<void>
  /** Runs newest first (by request time), `limit` from `offset`, with the total of all runs. */
  list(offset: number, limit: number): Promise<{ runs: CatalogImportRun[]; total: number }>
  /** The run holding the slot (`requested` or `running`), or null. */
  findActive(): Promise<CatalogImportRun | null>
  /** When the latest manual run was requested, whatever became of it, or null before any. */
  findLatestManualRequestedAt(): Promise<Date | null>
  /** The newest run, or null before any was recorded. */
  findLatest(): Promise<CatalogImportRun | null>
  /**
   * The run that most recently reached a terminal status (`succeeded`, `safety_stop`, `failed` or
   * `interrupted`), or null before any did.
   */
  findLatestFinished(): Promise<CatalogImportRun | null>
}
