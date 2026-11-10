import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  createMockCatalogImportRun,
  createMockCatalogImportRunRepository,
  createMockClock,
  createMockGameRepository,
  FIXED_NOW,
  type MockCatalogImportRunRepository,
  type MockClock,
  type MockGameRepository,
} from '@test/mocks'
import {
  CatalogImportRunRecorder,
  type CatalogImportRunRecorderConfig,
} from './catalog-import-run-recorder'
import {
  CatalogImportSafetyError,
  type CatalogImportInput,
  type CatalogImportSummary,
  type ICatalogImportUseCase,
} from './catalog-import.use-case'

const CONFIG: CatalogImportRunRecorderConfig = {
  heartbeatIntervalMs: 30_000,
  staleHeartbeatMs: 120_000,
  staleRequestedMs: 600_000,
  errorMessageMaxLength: 50,
}

const SUMMARY: CatalogImportSummary = {
  created: 4,
  updated: 10,
  delisted: 1,
  relisted: 2,
  received: 16,
  dropped: 1,
  invalid: 3,
  durationMs: 1234,
}

type ExecuteMock = Mock<(input?: CatalogImportInput) => Promise<CatalogImportSummary>>

let runs: MockCatalogImportRunRepository
let games: MockGameRepository
let clock: MockClock
let execute: ExecuteMock
let recorder: CatalogImportRunRecorder

beforeEach(() => {
  runs = createMockCatalogImportRunRepository()
  games = createMockGameRepository()
  games.countListed.mockResolvedValue(1675)
  clock = createMockClock()
  execute = vi.fn<ExecuteMock>().mockResolvedValue(SUMMARY)
  const importUseCase: ICatalogImportUseCase = { execute }
  recorder = new CatalogImportRunRecorder(runs, games, importUseCase, clock, CONFIG)
})

afterEach(() => {
  vi.useRealTimers()
})

/** An import that ends only when the test says so, to observe the heartbeat in between. */
function holdImport(): (summary: CatalogImportSummary) => void {
  let finish: (summary: CatalogImportSummary) => void = () => undefined
  execute.mockReturnValue(
    new Promise<CatalogImportSummary>((resolve) => {
      finish = resolve
    })
  )
  return (summary) => finish(summary)
}

describe('CatalogImportRunRecorder', () => {
  it('records a succeeded run with the summary counts and the Listed Games count', async () => {
    const result = await recorder.run({ trigger: 'scheduled', requestedBy: null })

    expect(result).toEqual({ kind: 'succeeded', runId: 'run-1', summary: SUMMARY })
    expect(runs.claim).toHaveBeenCalledWith({
      trigger: 'scheduled',
      requestedBy: null,
      now: FIXED_NOW,
    })
    expect(runs.finish).toHaveBeenCalledWith(
      'run-1',
      {
        status: 'succeeded',
        summary: {
          created: 4,
          updated: 10,
          delisted: 1,
          relisted: 2,
          received: 16,
          dropped: 1,
          invalid: 3,
        },
        listedGames: 1675,
      },
      FIXED_NOW
    )
  })

  it('passes the fraction-check override to the import and defaults it to off', async () => {
    await recorder.run({ trigger: 'scheduled', requestedBy: null, overrideFractionCheck: true })
    await recorder.run({ trigger: 'scheduled', requestedBy: null })

    expect(execute).toHaveBeenNthCalledWith(1, { overrideFractionCheck: true })
    expect(execute).toHaveBeenNthCalledWith(2, { overrideFractionCheck: false })
  })

  it('records a safety stop with its message and the Listed Games count', async () => {
    const error = new CatalogImportSafetyError('below_floor', 'only 3 candidates')
    execute.mockRejectedValue(error)

    const result = await recorder.run({ trigger: 'scheduled', requestedBy: null })

    expect(result).toEqual({ kind: 'safety_stop', runId: 'run-1', error })
    expect(runs.finish).toHaveBeenCalledWith(
      'run-1',
      { status: 'safety_stop', errorMessage: 'only 3 candidates', listedGames: 1675 },
      FIXED_NOW
    )
  })

  it('records a failure with a message cut to the limit', async () => {
    const error = new Error('x'.repeat(80))
    execute.mockRejectedValue(error)

    const result = await recorder.run({ trigger: 'scheduled', requestedBy: null })

    expect(result).toEqual({ kind: 'failed', runId: 'run-1', error })
    expect(runs.finish).toHaveBeenCalledWith(
      'run-1',
      { status: 'failed', errorMessage: 'x'.repeat(50), listedGames: 1675 },
      FIXED_NOW
    )
  })

  it('still records the outcome when the Listed Games count cannot be read', async () => {
    games.countListed.mockRejectedValue(new Error('connection lost'))

    await recorder.run({ trigger: 'scheduled', requestedBy: null })

    expect(runs.finish).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ status: 'succeeded', listedGames: null }),
      FIXED_NOW
    )
  })

  it('records nothing and does not import while another run holds the slot', async () => {
    runs.claim.mockResolvedValue(null)

    const result = await recorder.run({ trigger: 'scheduled', requestedBy: null })

    expect(result).toEqual({ kind: 'busy' })
    expect(execute).not.toHaveBeenCalled()
    expect(runs.finish).not.toHaveBeenCalled()
  })

  it('frees the slot of abandoned runs before every claim', async () => {
    await recorder.run({ trigger: 'scheduled', requestedBy: null })

    expect(runs.interruptStale).toHaveBeenCalledWith(
      {
        heartbeatBefore: new Date(FIXED_NOW.getTime() - 120_000),
        requestedBefore: new Date(FIXED_NOW.getTime() - 600_000),
      },
      FIXED_NOW
    )
    expect(runs.interruptStale.mock.invocationCallOrder[0]).toBeLessThan(
      runs.claim.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('proves the run alive every interval until the import ends', async () => {
    vi.useFakeTimers()
    const finishImport = holdImport()

    const running = recorder.run({ trigger: 'scheduled', requestedBy: null })
    await vi.advanceTimersByTimeAsync(65_000)
    expect(runs.heartbeat).toHaveBeenCalledTimes(2)
    expect(runs.heartbeat).toHaveBeenCalledWith('run-1', FIXED_NOW)

    finishImport(SUMMARY)
    await running
    await vi.advanceTimersByTimeAsync(120_000)
    expect(runs.heartbeat).toHaveBeenCalledTimes(2)
  })

  it('keeps the heartbeat running until the outcome is recorded, then stops it', async () => {
    vi.useFakeTimers()
    let finishCount: (count: number) => void = () => undefined
    games.countListed.mockReturnValue(
      new Promise<number>((resolve) => {
        finishCount = resolve
      })
    )

    const running = recorder.run({ trigger: 'scheduled', requestedBy: null })
    await vi.advanceTimersByTimeAsync(0)
    expect(execute).toHaveBeenCalled()
    // The import is over; the post-import count is slow.
    await vi.advanceTimersByTimeAsync(95_000)
    expect(runs.heartbeat).toHaveBeenCalledTimes(3)

    finishCount(1675)
    await running
    await vi.advanceTimersByTimeAsync(120_000)
    expect(runs.heartbeat).toHaveBeenCalledTimes(3)
  })

  it('stops the heartbeat when the import fails, or when recording the outcome fails', async () => {
    vi.useFakeTimers()
    execute.mockRejectedValue(new Error('boom'))
    runs.finish.mockRejectedValue(new Error('connection lost'))

    await expect(recorder.run({ trigger: 'scheduled', requestedBy: null })).rejects.toThrow(
      'connection lost'
    )
    await vi.advanceTimersByTimeAsync(120_000)

    expect(runs.heartbeat).not.toHaveBeenCalled()
  })

  it('survives a heartbeat that cannot be written and reports it', async () => {
    vi.useFakeTimers()
    const failure = new Error('connection lost')
    runs.heartbeat.mockRejectedValue(failure)
    const onHeartbeatError = vi.fn()
    const reporting = new CatalogImportRunRecorder(
      runs,
      games,
      { execute },
      clock,
      CONFIG,
      onHeartbeatError
    )
    const finishImport = holdImport()

    const running = reporting.run({ trigger: 'scheduled', requestedBy: null })
    await vi.advanceTimersByTimeAsync(31_000)
    finishImport(SUMMARY)

    await expect(running).resolves.toMatchObject({ kind: 'succeeded' })
    expect(onHeartbeatError).toHaveBeenCalledWith(failure)
  })

  it('survives a heartbeat that cannot be written without a reporter', async () => {
    vi.useFakeTimers()
    runs.heartbeat.mockRejectedValue(new Error('connection lost'))
    const finishImport = holdImport()

    const running = recorder.run({ trigger: 'scheduled', requestedBy: null })
    await vi.advanceTimersByTimeAsync(31_000)
    finishImport(SUMMARY)

    await expect(running).resolves.toMatchObject({ kind: 'succeeded' })
  })

  it('does not hide a failure to record the outcome', async () => {
    runs.finish.mockRejectedValue(new Error('connection lost'))

    await expect(recorder.run({ trigger: 'scheduled', requestedBy: null })).rejects.toThrow(
      'connection lost'
    )
  })
})

describe('CatalogImportRunRecorder.runNextRequested', () => {
  const queued = { trigger: 'manual', status: 'running' } as const

  it('is idle and imports nothing when no run is queued or another executor took it', async () => {
    runs.claimRequested.mockResolvedValue(null)

    const result = await recorder.runNextRequested()

    expect(result).toEqual({ kind: 'idle' })
    expect(execute).not.toHaveBeenCalled()
    expect(runs.claim).not.toHaveBeenCalled()
    expect(runs.finish).not.toHaveBeenCalled()
  })

  it('frees abandoned runs, claims the queued run and records the outcome like any run', async () => {
    runs.claimRequested.mockResolvedValue(createMockCatalogImportRun({ ...queued, id: 'run-7' }))

    const result = await recorder.runNextRequested()

    expect(result).toEqual({ kind: 'succeeded', runId: 'run-7', summary: SUMMARY })
    expect(runs.interruptStale).toHaveBeenCalledOnce()
    expect(runs.claimRequested).toHaveBeenCalledWith(FIXED_NOW)
    expect(runs.finish).toHaveBeenCalledWith(
      'run-7',
      {
        status: 'succeeded',
        summary: {
          created: 4,
          updated: 10,
          delisted: 1,
          relisted: 2,
          received: 16,
          dropped: 1,
          invalid: 3,
        },
        listedGames: 1675,
      },
      FIXED_NOW
    )
  })

  it('frees only abandoned running runs, so a queued run of any age is claimed, not interrupted', async () => {
    runs.claimRequested.mockResolvedValue(createMockCatalogImportRun(queued))

    await recorder.runNextRequested()

    expect(runs.interruptStale).toHaveBeenCalledWith(
      { heartbeatBefore: new Date(FIXED_NOW.getTime() - 120_000) },
      FIXED_NOW
    )
    expect(runs.interruptStale.mock.invocationCallOrder[0]).toBeLessThan(
      runs.claimRequested.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('never lets the fraction check be bypassed', async () => {
    runs.claimRequested.mockResolvedValue(createMockCatalogImportRun(queued))

    await recorder.runNextRequested()

    expect(execute).toHaveBeenCalledWith({ overrideFractionCheck: false })
  })

  it('records a safety stop and a failure instead of throwing', async () => {
    runs.claimRequested.mockResolvedValue(createMockCatalogImportRun({ ...queued, id: 'run-8' }))
    execute.mockRejectedValueOnce(new Error('IGDB is unavailable'))

    const result = await recorder.runNextRequested()

    expect(result).toMatchObject({ kind: 'failed', runId: 'run-8' })
    expect(runs.finish).toHaveBeenCalledWith(
      'run-8',
      { status: 'failed', errorMessage: 'IGDB is unavailable', listedGames: 1675 },
      FIXED_NOW
    )
  })

  it('keeps the heartbeat running for the claimed run', async () => {
    vi.useFakeTimers()
    runs.claimRequested.mockResolvedValue(createMockCatalogImportRun({ ...queued, id: 'run-9' }))
    const finish = holdImport()

    const pending = recorder.runNextRequested()
    await vi.advanceTimersByTimeAsync(CONFIG.heartbeatIntervalMs)
    expect(runs.heartbeat).toHaveBeenCalledWith('run-9', FIXED_NOW)

    finish(SUMMARY)
    await pending
  })
})
