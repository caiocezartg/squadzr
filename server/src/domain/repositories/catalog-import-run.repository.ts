import type {
  CatalogImportRun,
  CatalogImportRunOutcome,
  ClaimCatalogImportRunInput,
} from '@domain/entities/catalog-import-run.entity'

/** How long a run may be silent before it counts as abandoned. */
export interface CatalogImportRunStaleness {
  /** A `running` run whose heartbeat is older than this instant is abandoned. */
  readonly heartbeatBefore: Date
  /** A `requested` run nobody claimed since this instant is abandoned. */
  readonly requestedBefore: Date
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
  /** Proves a `running` run is alive. */
  heartbeat(id: string, now: Date): Promise<void>
  /** Ends a `running` run with its outcome. */
  finish(id: string, outcome: CatalogImportRunOutcome, now: Date): Promise<void>
  /** Runs newest first (by request time), `limit` from `offset`, with the total of all runs. */
  list(offset: number, limit: number): Promise<{ runs: CatalogImportRun[]; total: number }>
  /** The newest run, or null before any was recorded. */
  findLatest(): Promise<CatalogImportRun | null>
  /**
   * The run that most recently reached a terminal status (`succeeded`, `safety_stop`, `failed` or
   * `interrupted`), or null before any did.
   */
  findLatestFinished(): Promise<CatalogImportRun | null>
}
