import { sql } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'

export interface HealthResponse {
  status: 'ok' | 'error'
  timestamp: string
  uptime: number
  version: string
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
  async check(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await reply.status(200).send(buildHealthResponse('ok'))
  }

  async readiness(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      await request.server.db.execute(sql`SELECT 1`)
      await reply.status(200).send(buildHealthResponse('ok'))
    } catch {
      await reply.status(503).send(buildHealthResponse('error'))
    }
  }
}
