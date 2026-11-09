import { ADMIN_GAME_CHANGE_NAMES_LIMIT } from '@squadzr/schemas'
import type { AdminGameChange, AdminGameCounts } from '@domain/entities/admin-game.entity'
import type { IAdminGameRepository } from '@domain/repositories/admin-game.repository'
import type { ICatalogImportRunRepository } from '@domain/repositories/catalog-import-run.repository'

/** The games that entered and left the catalog in the last succeeded Catalog Import Run. */
export interface LastImportChanges {
  readonly runId: string
  readonly finishedAt: Date
  readonly entered: AdminGameChange
  readonly left: AdminGameChange
}

export interface GetAdminGamesSummaryOutput extends AdminGameCounts {
  /** Null before any run succeeded. */
  readonly lastImport: LastImportChanges | null
}

export interface IGetAdminGamesSummaryUseCase {
  execute(): Promise<GetAdminGamesSummaryOutput>
}

/**
 * The Games tab's header: the catalog's size by state and what the last succeeded import changed. The
 * changes are the Games created (entered) or delisted (left) between that run's start and finish.
 */
export class GetAdminGamesSummaryUseCase implements IGetAdminGamesSummaryUseCase {
  constructor(
    private readonly adminGameRepository: IAdminGameRepository,
    private readonly catalogImportRunRepository: ICatalogImportRunRepository
  ) {}

  async execute(): Promise<GetAdminGamesSummaryOutput> {
    const [counts, run] = await Promise.all([
      this.adminGameRepository.count(),
      this.catalogImportRunRepository.findLatestSucceeded(),
    ])
    if (!run?.startedAt || !run.finishedAt) return { ...counts, lastImport: null }

    const changes = await this.adminGameRepository.findChanges(
      { from: run.startedAt, to: run.finishedAt },
      ADMIN_GAME_CHANGE_NAMES_LIMIT
    )

    return {
      ...counts,
      lastImport: {
        runId: run.id,
        finishedAt: run.finishedAt,
        entered: changes.entered,
        left: changes.left,
      },
    }
  }
}
