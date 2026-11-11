import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordedRequestedCatalogImportRun } from '@application/use-cases/game/catalog-import-run-recorder'
import { CatalogImportExecutor } from './catalog-import-executor'

const OPTIONS = { pollIntervalMs: 5_000, shutdownGraceMs: 1_000 }
const SUCCEEDED: RecordedRequestedCatalogImportRun = {
  kind: 'succeeded',
  runId: 'run-1',
  summary: {
    created: 0,
    updated: 0,
    delisted: 0,
    relisted: 0,
    received: 0,
    dropped: 0,
    invalid: 0,
    durationMs: 1,
  },
}

let runNextRequested: ReturnType<typeof vi.fn<() => Promise<RecordedRequestedCatalogImportRun>>>
let log: { error: ReturnType<typeof vi.fn> }
let executor: CatalogImportExecutor

beforeEach(() => {
  vi.useFakeTimers()
  runNextRequested = vi.fn<() => Promise<RecordedRequestedCatalogImportRun>>()
  runNextRequested.mockResolvedValue({ kind: 'idle' })
  log = { error: vi.fn() }
  executor = new CatalogImportExecutor({ runNextRequested }, log, OPTIONS)
})

afterEach(async () => {
  await executor.stop()
  vi.useRealTimers()
})

describe('CatalogImportExecutor', () => {
  it('looks for a queued run at start, so a run left by a restart starts after boot', async () => {
    executor.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(runNextRequested).toHaveBeenCalledOnce()
  })

  it('polls on the interval', async () => {
    executor.start()
    await vi.advanceTimersByTimeAsync(OPTIONS.pollIntervalMs * 2)

    expect(runNextRequested).toHaveBeenCalledTimes(3)
  })

  it('looks again at once when woken, and keeps going while runs are queued', async () => {
    runNextRequested.mockResolvedValueOnce(SUCCEEDED).mockResolvedValueOnce(SUCCEEDED)

    executor.wake()
    await vi.advanceTimersByTimeAsync(0)

    expect(runNextRequested).toHaveBeenCalledTimes(3)
  })

  it('does not start a second pass while one is in flight', async () => {
    let finish: (result: RecordedRequestedCatalogImportRun) => void = () => undefined
    runNextRequested.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )

    executor.wake()
    executor.wake()
    expect(runNextRequested).toHaveBeenCalledOnce()

    finish({ kind: 'idle' })
    await vi.advanceTimersByTimeAsync(0)
  })

  it('logs a run that ended without a success and a failure to start, and tries again on the next poll', async () => {
    runNextRequested
      .mockResolvedValueOnce({ kind: 'failed', runId: 'run-1', error: new Error('IGDB down') })
      .mockRejectedValueOnce(new Error('database down'))

    executor.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(OPTIONS.pollIntervalMs)

    expect(log.error).toHaveBeenCalledTimes(2)
    expect(runNextRequested.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('stops polling and ignores a wake once stopped', async () => {
    executor.start()
    await vi.advanceTimersByTimeAsync(0)
    await executor.stop()
    runNextRequested.mockClear()

    executor.wake()
    await vi.advanceTimersByTimeAsync(OPTIONS.pollIntervalMs * 3)

    expect(runNextRequested).not.toHaveBeenCalled()
  })

  it('waits for the run in flight on stop, but only for the grace period', async () => {
    runNextRequested.mockReturnValue(new Promise(() => undefined))
    executor.wake()

    let stopped = false
    const stopping = executor.stop().then(() => {
      stopped = true
    })
    await vi.advanceTimersByTimeAsync(OPTIONS.shutdownGraceMs - 1)
    expect(stopped).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await stopping
    expect(stopped).toBe(true)
  })
})
