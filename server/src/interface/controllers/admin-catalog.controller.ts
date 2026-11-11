import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { pageQuerySchema } from '@squadzr/schemas'
import type { IListCatalogImportRunsUseCase } from '@application/use-cases/admin/list-catalog-import-runs.use-case'
import type { IRequestCatalogImportRunUseCase } from '@application/use-cases/admin/request-catalog-import-run.use-case'
import { toCatalogImportRunDto } from '@application/projections'

type PageQuery = z.infer<typeof pageQuerySchema>

export interface AdminCatalogControllerDeps {
  readonly listCatalogImportRunsUseCase: IListCatalogImportRunsUseCase
  readonly requestCatalogImportRunUseCase: IRequestCatalogImportRunUseCase
  /** Nudges the executor to look for the run just queued instead of waiting for its poll. */
  readonly wakeExecutor: () => void
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
      manualRun: result.manualRun.available
        ? { available: true as const }
        : { available: false as const, availableAt: result.manualRun.availableAt.toISOString() },
      activeRun: result.activeRun ? toCatalogImportRunDto(result.activeRun) : null,
    })
  }

  /** Takes no body and no option: the use case has nothing to read from the request but the admin. */
  async requestRun(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const run = await this.deps.requestCatalogImportRunUseCase.execute({
      actor: { id: request.userId, name: request.session?.user.name ?? '' },
    })
    this.deps.wakeExecutor()

    await reply.code(202).send(toCatalogImportRunDto(run))
  }
}
