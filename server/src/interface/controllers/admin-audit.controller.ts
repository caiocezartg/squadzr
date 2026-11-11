import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { pageQuerySchema } from '@squadzr/schemas'
import type { IListAuditEntriesUseCase } from '@application/use-cases/admin/list-audit-entries.use-case'
import { toAuditEntryDto } from '@application/projections'

type PageQuery = z.infer<typeof pageQuerySchema>

export interface AdminAuditControllerDeps {
  readonly listAuditEntriesUseCase: IListAuditEntriesUseCase
}

export class AdminAuditController {
  constructor(private readonly deps: AdminAuditControllerDeps) {}

  async list(
    request: FastifyRequest<{ Querystring: PageQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.listAuditEntriesUseCase.execute({ page: request.query.page })

    await reply.send({
      items: result.entries.map(toAuditEntryDto),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    })
  }
}
