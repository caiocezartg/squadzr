import { MANUAL_CATALOG_IMPORT_LIMIT_MS } from '@squadzr/schemas'
import type { CatalogImportRun } from '@domain/entities/catalog-import-run.entity'
import type { ICatalogImportRunRepository } from '@domain/repositories/catalog-import-run.repository'
import type { Clock } from '@domain/services/clock.interface'
import {
  CatalogImportManualLimitError,
  CatalogImportRunningError,
  CatalogImportUnavailableError,
} from '@application/errors'

export interface RequestCatalogImportRunInput {
  readonly actor: { readonly id: string; readonly name: string }
}

export interface IRequestCatalogImportRunUseCase {
  execute(input: RequestCatalogImportRunInput): Promise<CatalogImportRun>
}

/**
 * An admin asks for a manual Catalog Import. This only queues the run (and writes the
 * `catalog_import_requested` Audit Entry with it); an executor picks it up. It carries no option, so
 * nothing in a request can bypass the import's safety checks.
 */
export class RequestCatalogImportRunUseCase implements IRequestCatalogImportRunUseCase {
  constructor(
    private readonly runRepository: ICatalogImportRunRepository,
    private readonly clock: Clock,
    /** False when the API has no IGDB credentials: nothing could run the request. */
    private readonly importConfigured: boolean
  ) {}

  async execute(input: RequestCatalogImportRunInput): Promise<CatalogImportRun> {
    if (!this.importConfigured) throw new CatalogImportUnavailableError()

    const now = this.clock.now()
    const outcome = await this.runRepository.requestManual({
      requestedBy: input.actor,
      now,
      requestedAfter: new Date(now.getTime() - MANUAL_CATALOG_IMPORT_LIMIT_MS),
      buildAuditEntry: (run, requestedAt) => ({
        actorId: input.actor.id,
        actorName: input.actor.name,
        action: 'catalog_import_requested',
        target: null,
        reason: null,
        details: { runId: run.id },
        createdAt: requestedAt,
      }),
    })

    switch (outcome.status) {
      case 'requested':
        return outcome.run
      case 'limit':
        throw new CatalogImportManualLimitError(
          new Date(outcome.lastRequestedAt.getTime() + MANUAL_CATALOG_IMPORT_LIMIT_MS)
        )
      case 'slot_taken':
        throw new CatalogImportRunningError()
    }
  }
}
