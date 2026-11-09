import type { CatalogImportRunTrigger } from '@squadzr/schemas'
import type { ClaimCatalogImportRunInput } from '@domain/entities/catalog-import-run.entity'
import type { ICatalogImportRunRepository } from '@domain/repositories/catalog-import-run.repository'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { Clock } from '@domain/services/clock.interface'
import {
  CatalogImportSafetyError,
  type CatalogImportSummary,
  type ICatalogImportUseCase,
} from './catalog-import.use-case'

export interface CatalogImportRunRecorderConfig {
  readonly heartbeatIntervalMs: number
  readonly staleHeartbeatMs: number
  readonly staleRequestedMs: number
  readonly errorMessageMaxLength: number
}

export interface RecordCatalogImportRunInput {
  readonly trigger: CatalogImportRunTrigger
  readonly requestedBy: ClaimCatalogImportRunInput['requestedBy']
  /** Bypasses only the import's fraction check; the cron alone sets it. */
  readonly overrideFractionCheck?: boolean
}

/** How a recorded run ended; `busy` means another run held the slot and nothing was recorded. */
export type RecordedCatalogImportRun =
  | { readonly kind: 'busy' }
  | { readonly kind: 'succeeded'; readonly runId: string; readonly summary: CatalogImportSummary }
  | {
      readonly kind: 'safety_stop'
      readonly runId: string
      readonly error: CatalogImportSafetyError
    }
  | { readonly kind: 'failed'; readonly runId: string; readonly error: unknown }

/** A run that was claimed and ran to an outcome. */
export type ExecutedCatalogImportRun = Exclude<RecordedCatalogImportRun, { readonly kind: 'busy' }>

/** What starting the next queued run came to; `idle` means nothing was queued for this executor. */
export type RecordedRequestedCatalogImportRun = { readonly kind: 'idle' } | ExecutedCatalogImportRun

type ImportResult =
  | { readonly kind: 'succeeded'; readonly summary: CatalogImportSummary }
  | { readonly kind: 'safety_stop'; readonly error: CatalogImportSafetyError }
  | { readonly kind: 'failed'; readonly error: unknown }

export interface ICatalogImportRunRecorder {
  run(input: RecordCatalogImportRunInput): Promise<RecordedCatalogImportRun>
  /**
   * Starts the oldest queued (`requested`) run and runs it. It takes no input: a queued run never
   * carries the fraction-check override, which stays the cron's alone.
   */
  runNextRequested(): Promise<RecordedRequestedCatalogImportRun>
}

/**
 * Runs one Catalog Import and records it as a Catalog Import Run. It frees the slot of an abandoned run,
 * claims the slot, keeps a heartbeat until the outcome is recorded, runs the import, reads the Listed Games count afterwards (also after a
 * safety stop or a failure) and records the outcome. Every run-row write is its own statement on the run
 * repository, outside the import's transaction, so the import's rollback never erases the outcome.
 */
export class CatalogImportRunRecorder implements ICatalogImportRunRecorder {
  constructor(
    private readonly runRepository: ICatalogImportRunRepository,
    private readonly gameRepository: IGameRepository,
    private readonly importUseCase: ICatalogImportUseCase,
    private readonly clock: Clock,
    private readonly config: CatalogImportRunRecorderConfig,
    /** Told when a heartbeat cannot be written; the run goes on, staleness handles a dead one. */
    private readonly onHeartbeatError: (error: unknown) => void = () => undefined
  ) {}

  async run(input: RecordCatalogImportRunInput): Promise<RecordedCatalogImportRun> {
    const now = this.clock.now()
    await this.interruptStale(now)

    const run = await this.runRepository.claim({
      trigger: input.trigger,
      requestedBy: input.requestedBy,
      now,
    })
    if (!run) return { kind: 'busy' }

    return this.runClaimed(run.id, input.overrideFractionCheck ?? false)
  }

  async runNextRequested(): Promise<RecordedRequestedCatalogImportRun> {
    const now = this.clock.now()
    await this.interruptStale(now)

    const run = await this.runRepository.claimRequested(now)
    if (!run) return { kind: 'idle' }

    return this.runClaimed(run.id, false)
  }

  private async interruptStale(now: Date): Promise<void> {
    await this.runRepository.interruptStale(
      {
        heartbeatBefore: new Date(now.getTime() - this.config.staleHeartbeatMs),
        requestedBefore: new Date(now.getTime() - this.config.staleRequestedMs),
      },
      now
    )
  }

  private async runClaimed(
    runId: string,
    overrideFractionCheck: boolean
  ): Promise<ExecutedCatalogImportRun> {
    // The heartbeat covers the whole run, down to the outcome write, so a slow post-import step
    // cannot let another claimer mark this run interrupted.
    const stopHeartbeat = this.startHeartbeat(runId)
    try {
      return await this.runAndRecord(runId, overrideFractionCheck)
    } finally {
      stopHeartbeat()
    }
  }

  private async runAndRecord(
    runId: string,
    overrideFractionCheck: boolean
  ): Promise<ExecutedCatalogImportRun> {
    const result = await this.executeImport(overrideFractionCheck)
    const listedGames = await this.countListedGames()
    const finishedAt = this.clock.now()

    if (result.kind === 'succeeded') {
      const { created, updated, delisted, relisted, received, dropped, invalid } = result.summary
      await this.runRepository.finish(
        runId,
        {
          status: 'succeeded',
          summary: { created, updated, delisted, relisted, received, dropped, invalid },
          listedGames,
        },
        finishedAt
      )

      return { ...result, runId }
    }

    await this.runRepository.finish(
      runId,
      { status: result.kind, errorMessage: this.toMessage(result.error), listedGames },
      finishedAt
    )

    return { ...result, runId }
  }

  /** Whatever the import throws becomes a result, never an exception. */
  private async executeImport(overrideFractionCheck: boolean): Promise<ImportResult> {
    try {
      const summary = await this.importUseCase.execute({ overrideFractionCheck })
      return { kind: 'succeeded', summary }
    } catch (error) {
      return error instanceof CatalogImportSafetyError
        ? { kind: 'safety_stop', error }
        : { kind: 'failed', error }
    }
  }

  /** A heartbeat that cannot be written must not take the import down; it is reported, not thrown. */
  private startHeartbeat(runId: string): () => void {
    const timer = setInterval(() => {
      this.runRepository.heartbeat(runId, this.clock.now()).catch(this.onHeartbeatError)
    }, this.config.heartbeatIntervalMs)

    return () => clearInterval(timer)
  }

  /** The count is a courtesy of the history: failing to read it must not hide the outcome. */
  private async countListedGames(): Promise<number | null> {
    try {
      return await this.gameRepository.countListed()
    } catch {
      return null
    }
  }

  private toMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    return message.slice(0, this.config.errorMessageMaxLength)
  }
}
