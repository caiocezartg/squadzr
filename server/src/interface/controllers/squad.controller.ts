import type { FastifyReply, FastifyRequest } from 'fastify'
import type { SquadLifecycle } from '@domain/squad-lifecycle'

type PublicSquadLifecycle = Pick<SquadLifecycle, 'listRecruitingSquads' | 'getPublic'>

export class SquadController {
  constructor(private readonly lifecycle: PublicSquadLifecycle) {}

  async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await reply.send({ squads: await this.lifecycle.listRecruitingSquads() })
  }

  async getPublic(
    request: FastifyRequest<{ Params: { code: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const squad = await this.lifecycle.getPublic(request.params.code)

    if (!squad) {
      await reply.status(404).send({
        error: 'Not Found',
        message: 'Recruiting Squad not found',
      })
      return
    }

    await reply.send({ squad })
  }
}
