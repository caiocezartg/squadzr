import type { FastifyReply, FastifyRequest } from 'fastify'
import type { HealthResponse } from '@squadzr/schemas'
import type { ICheckReadinessUseCase } from '@application/use-cases/health/check-readiness.use-case'

export interface HealthControllerDeps {
  readonly checkReadinessUseCase: ICheckReadinessUseCase
}

const HEALTH_VERSION = '0.1.0'

/** Builds the payload every health probe answers with, so all three share one shape. */
function buildHealthResponse(status: HealthResponse['status']): HealthResponse {
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: HEALTH_VERSION,
  }
}

export class HealthController {
  constructor(private readonly deps: HealthControllerDeps) {}

  async check(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await reply.status(200).send(buildHealthResponse('ok'))
  }

  async readiness(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await this.deps.checkReadinessUseCase.execute()

    if (!result.ready) {
      await reply.status(503).send(buildHealthResponse('error'))
      return
    }
    await reply.status(200).send(buildHealthResponse('ok'))
  }
}
