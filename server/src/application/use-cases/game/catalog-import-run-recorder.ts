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

type ImportResult =
  | { readonly kind: 'succeeded'; readonly summary: CatalogImportSummary }
  | { readonly kind: 'safety_stop'; readonly error: CatalogImportSafetyError }
  | { readonly kind: 'failed'; readonly error: unknown }

export interface ICatalogImportRunRecorder {
  run(input: RecordCatalogImportRunInput): Promise<RecordedCatalogImportRun>
}

/**
 * Runs one Catalog Import and records it as a Catalog Import Run. It frees the slot of an abandoned run,
 * claims the slot, runs the import with a heartbeat, reads the Listed Games count afterwards (also after a
 * safety stop or a failure) and records the outcome. Every run-row write is its own statement on the run
 * repository, outside the import's transaction, so the import's rollback never erases the outcome.
 */
export class CatalogImportRunRecorder implements ICatalogImportRunRecorder {
  constructor(
    private readonly runRepository: ICatalogImportRunRepository,
    private readonly gameRepository: IGameRepository,
    private readonly importUseCase: ICatalogImportUseCase,
    private readonly clock: Clock,
    private readonly config: CatalogImportRunRecorderConfig
  ) {}

  async run(input: RecordCatalogImportRunInput): Promise<RecordedCatalogImportRun> {
    const now = this.clock.now()
    await this.runRepository.interruptStale(
      {
        heartbeatBefore: new Date(now.getTime() - this.config.staleHeartbeatMs),
        requestedBefore: new Date(now.getTime() - this.config.staleRequestedMs),
      },
      now
    )

    const run = await this.runRepository.claim({
      trigger: input.trigger,
      requestedBy: input.requestedBy,
      now,
    })
    if (!run) return { kind: 'busy' }

    const result = await this.executeImport(run.id, input)
    const listedGames = await this.countListedGames()
    const finishedAt = this.clock.now()

    if (result.kind === 'succeeded') {
      const { created, updated, delisted, relisted, received, dropped, invalid } = result.summary
      await this.runRepository.finish(
        run.id,
        {
          status: 'succeeded',
          summary: { created, updated, delisted, relisted, received, dropped, invalid },
          listedGames,
        },
        finishedAt
      )

      return { ...result, runId: run.id }
    }

    await this.runRepository.finish(
      run.id,
      { status: result.kind, errorMessage: this.toMessage(result.error), listedGames },
      finishedAt
    )

    return { ...result, runId: run.id }
  }

  /** Runs the import under a heartbeat; whatever it throws becomes a result, never an exception. */
  private async executeImport(
    runId: string,
    input: RecordCatalogImportRunInput
  ): Promise<ImportResult> {
    const stopHeartbeat = this.startHeartbeat(runId)
    try {
      const summary = await this.importUseCase.execute({
        overrideFractionCheck: input.overrideFractionCheck ?? false,
      })
      return { kind: 'succeeded', summary }
    } catch (error) {
      return error instanceof CatalogImportSafetyError
        ? { kind: 'safety_stop', error }
        : { kind: 'failed', error }
    } finally {
      stopHeartbeat()
    }
  }

  /** A heartbeat that cannot be written must not take the import down; staleness handles a dead run. */
  private startHeartbeat(runId: string): () => void {
    const timer = setInterval(() => {
      this.runRepository.heartbeat(runId, this.clock.now()).catch(() => undefined)
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
