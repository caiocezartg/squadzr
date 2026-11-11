import type {
  ICatalogImportRunRecorder,
  RecordedRequestedCatalogImportRun,
} from '@application/use-cases/game/catalog-import-run-recorder'

export interface CatalogImportExecutorLog {
  error(context: { err: unknown }, message: string): void
}

export interface CatalogImportExecutorOptions {
  /** How often the executor looks for a queued run besides being woken by a request. */
  readonly pollIntervalMs: number
  /** How long a stop waits for the run in flight before letting go of it. */
  readonly shutdownGraceMs: number
}

/**
 * The executor inside the API: it starts the queued (`requested`) Catalog Import Run through the shared
 * run recorder, right after a request (`wake`), at boot and on a short poll, so a run requested just
 * before a restart still starts after it. The recorder claims the row with one conditional update, so
 * two executors never run the same one. A dedicated worker can replace this class without touching the
 * route, the table or the panel. Nothing escapes it: a failure is logged and the next poll tries again.
 */
export class CatalogImportExecutor {
  private timer: ReturnType<typeof setInterval> | null = null
  private inFlight: Promise<void> | null = null
  private stopped = false
  private stopping: Promise<void> | null = null

  constructor(
    private readonly recorder: Pick<ICatalogImportRunRecorder, 'runNextRequested'>,
    private readonly log: CatalogImportExecutorLog,
    private readonly options: CatalogImportExecutorOptions
  ) {}

  /** Looks for a queued run now and then on every poll; the timer never keeps the process alive. */
  start(): void {
    if (this.timer || this.stopped) return

    this.timer = setInterval(() => this.wake(), this.options.pollIntervalMs)
    this.timer.unref()
    this.wake()
  }

  /** Looks for a queued run now. A pass already in flight is not doubled. */
  wake(): void {
    if (this.stopped || this.inFlight) return

    this.inFlight = this.drain().finally(() => {
      this.inFlight = null
    })
  }

  /** Stops polling and waits, up to the grace period, for the run in flight. Safe to call twice. */
  stop(): Promise<void> {
    this.stopping ??= this.shutDown()
    return this.stopping
  }

  private async shutDown(): Promise<void> {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null

    const inFlight = this.inFlight
    if (!inFlight) return

    let graceTimer: ReturnType<typeof setTimeout> | undefined
    const grace = new Promise<void>((resolve) => {
      graceTimer = setTimeout(resolve, this.options.shutdownGraceMs)
    })
    try {
      await Promise.race([inFlight, grace])
    } finally {
      clearTimeout(graceTimer)
    }
  }

  private async drain(): Promise<void> {
    try {
      let result: RecordedRequestedCatalogImportRun
      do {
        result = await this.recorder.runNextRequested()
        if (result.kind === 'failed' || result.kind === 'safety_stop') {
          this.log.error({ err: result.error }, 'Catalog Import Run ended without a success')
        }
      } while (result.kind !== 'idle' && !this.stopped)
    } catch (error) {
      this.log.error({ err: error }, 'Catalog Import executor could not start a queued run')
    }
  }
}
