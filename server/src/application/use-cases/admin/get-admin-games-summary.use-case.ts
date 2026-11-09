import { ADMIN_GAME_CHANGE_NAMES_LIMIT, type CatalogImportRunStatus } from '@squadzr/schemas'
import type { AdminGameChange, AdminGameCounts } from '@domain/entities/admin-game.entity'
import type { IAdminGameRepository } from '@domain/repositories/admin-game.repository'
import type { ICatalogImportRunRepository } from '@domain/repositories/catalog-import-run.repository'

/** The games that entered and left the catalog in the last finished Catalog Import Run. */
export interface LastImportChanges {
  readonly runId: string
  readonly status: CatalogImportRunStatus
  readonly finishedAt: Date
  readonly entered: AdminGameChange
  readonly left: AdminGameChange
}

export interface GetAdminGamesSummaryOutput extends AdminGameCounts {
  /** Null before any run finished. */
  readonly lastImport: LastImportChanges | null
}

export interface IGetAdminGamesSummaryUseCase {
  execute(): Promise<GetAdminGamesSummaryOutput>
}

/**
 * The Games tab's header: the catalog's size by state and what the last finished import changed. The
 * changes are the Games created (entered) or delisted (left) between that run's start and finish; a
 * run that did not succeed shows whatever it committed before it stopped, often nothing. A run that
 * never started (interrupted while still requested) is read from its request time.
 */
export class GetAdminGamesSummaryUseCase implements IGetAdminGamesSummaryUseCase {
  constructor(
    private readonly adminGameRepository: IAdminGameRepository,
    private readonly catalogImportRunRepository: ICatalogImportRunRepository
  ) {}

  async execute(): Promise<GetAdminGamesSummaryOutput> {
    const [counts, run] = await Promise.all([
      this.adminGameRepository.count(),
      this.catalogImportRunRepository.findLatestFinished(),
    ])
    if (!run?.finishedAt) return { ...counts, lastImport: null }

    const changes = await this.adminGameRepository.findChanges(
      { from: run.startedAt ?? run.requestedAt, to: run.finishedAt },
      ADMIN_GAME_CHANGE_NAMES_LIMIT
    )

    return {
      ...counts,
      lastImport: {
        runId: run.id,
        status: run.status,
        finishedAt: run.finishedAt,
        entered: changes.entered,
        left: changes.left,
      },
    }
  }
}
