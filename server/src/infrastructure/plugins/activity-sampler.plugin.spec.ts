import Fastify from 'fastify'
import fp from 'fastify-plugin'
import type { FastifyBaseLogger } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import activitySamplerPlugin, { runActivitySample } from './activity-sampler.plugin'
import type { IRunActivitySampleUseCase } from '@application/use-cases/admin/run-activity-sample.use-case'
import { ADMIN } from '@config/constants'

function createLog() {
  return { info: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger
}

describe('runActivitySample', () => {
  it('runs one sampling step', async () => {
    const useCase = { execute: vi.fn().mockResolvedValue(undefined) }

    await runActivitySample(createLog(), useCase)

    expect(useCase.execute).toHaveBeenCalledTimes(1)
  })

  it('swallows a failure and logs it instead of rejecting', async () => {
    const log = createLog()
    const failure = new Error('database unavailable')
    const useCase: IRunActivitySampleUseCase = { execute: vi.fn().mockRejectedValue(failure) }

    await expect(runActivitySample(log, useCase)).resolves.toBeUndefined()

    expect(log.error).toHaveBeenCalledWith({ err: failure }, 'Activity sampling failed')
  })
})

describe('activitySamplerPlugin', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function build(useCase: IRunActivitySampleUseCase) {
    const app = Fastify({ logger: false })
    // The plugin declares these as dependencies; stand-ins keep the spec off the database and sockets.
    await app.register(fp(async () => {}, { name: 'database' }))
    await app.register(fp(async () => {}, { name: 'websocket-handler' }))
    await app.register(activitySamplerPlugin, { runActivitySampleUseCase: useCase })
    return app
  }

  it('starts sampling every interval once the server is ready and stops when it closes', async () => {
    const useCase = { execute: vi.fn().mockResolvedValue(undefined) }
    const app = await build(useCase)

    await vi.advanceTimersByTimeAsync(ADMIN.ACTIVITY_SAMPLE_INTERVAL_MS * 2)
    expect(useCase.execute).not.toHaveBeenCalled()

    await app.ready()
    await vi.advanceTimersByTimeAsync(ADMIN.ACTIVITY_SAMPLE_INTERVAL_MS - 1)
    expect(useCase.execute).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(useCase.execute).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(ADMIN.ACTIVITY_SAMPLE_INTERVAL_MS)
    expect(useCase.execute).toHaveBeenCalledTimes(2)

    await app.close()
    await vi.advanceTimersByTimeAsync(ADMIN.ACTIVITY_SAMPLE_INTERVAL_MS * 3)
    expect(useCase.execute).toHaveBeenCalledTimes(2)
  })
})
