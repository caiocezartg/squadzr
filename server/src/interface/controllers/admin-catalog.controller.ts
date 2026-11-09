import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { pageQuerySchema } from '@squadzr/schemas'
import type { IListCatalogImportRunsUseCase } from '@application/use-cases/admin/list-catalog-import-runs.use-case'
import { toCatalogImportRunDto } from '@application/projections'

type PageQuery = z.infer<typeof pageQuerySchema>

export interface AdminCatalogControllerDeps {
  readonly listCatalogImportRunsUseCase: IListCatalogImportRunsUseCase
}

export class AdminCatalogController {
  constructor(private readonly deps: AdminCatalogControllerDeps) {}

  async listRuns(
    request: FastifyRequest<{ Querystring: PageQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.listCatalogImportRunsUseCase.execute({
      page: request.query.page,
    })

    await reply.send({
      items: result.runs.map(toCatalogImportRunDto),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    })
  }
}
