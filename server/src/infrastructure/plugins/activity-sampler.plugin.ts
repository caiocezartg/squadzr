import type { FastifyBaseLogger, FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import type { IRunActivitySampleUseCase } from '@application/use-cases/admin/run-activity-sample.use-case'
import { ADMIN } from '@config/constants'

export interface ActivitySamplerPluginOptions {
  /** Built by the composition root from the database, the clock and the connection registry. */
  readonly runActivitySampleUseCase: IRunActivitySampleUseCase
}

/**
 * One sampling step. A failure is logged and retried on the next tick, never brought down Fastify.
 */
export async function runActivitySample(
  log: FastifyBaseLogger,
  useCase: IRunActivitySampleUseCase
): Promise<void> {
  try {
    await useCase.execute()
  } catch (error) {
    log.error({ err: error }, 'Activity sampling failed')
  }
}

async function activitySamplerPlugin(
  fastify: FastifyInstance,
  { runActivitySampleUseCase }: ActivitySamplerPluginOptions
): Promise<void> {
  let intervalId: ReturnType<typeof setInterval>

  fastify.addHook('onReady', async () => {
    fastify.log.info({ intervalMs: ADMIN.ACTIVITY_SAMPLE_INTERVAL_MS }, 'Activity sampler started')

    intervalId = setInterval(() => {
      void runActivitySample(fastify.log, runActivitySampleUseCase)
    }, ADMIN.ACTIVITY_SAMPLE_INTERVAL_MS)
  })

  fastify.addHook('onClose', () => {
    clearInterval(intervalId)
  })
}

export default fp(activitySamplerPlugin, {
  name: 'activity-sampler',
  dependencies: ['database', 'websocket-handler'],
})
