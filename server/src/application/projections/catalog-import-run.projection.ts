import type { CatalogImportRunDto } from '@squadzr/schemas'
import type { CatalogImportRun } from '@domain/entities/catalog-import-run.entity'

export function toCatalogImportRunDto(run: CatalogImportRun): CatalogImportRunDto {
  return {
    id: run.id,
    trigger: run.trigger,
    requestedBy: run.requestedBy ? { ...run.requestedBy } : null,
    status: run.status,
    requestedAt: run.requestedAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    summary: run.summary ? { ...run.summary } : null,
    listedGames: run.listedGames,
    errorMessage: run.errorMessage,
  }
}
