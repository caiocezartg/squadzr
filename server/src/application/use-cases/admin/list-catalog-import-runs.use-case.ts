import { MANUAL_CATALOG_IMPORT_LIMIT_MS, PAGE_SIZE } from '@squadzr/schemas'
import type { CatalogImportRun } from '@domain/entities/catalog-import-run.entity'
import type { ICatalogImportRunRepository } from '@domain/repositories/catalog-import-run.repository'
import type { Clock } from '@domain/services/clock.interface'

export interface ListCatalogImportRunsInput {
  /** 1-based; a page past the end gives no runs and the real total. */
  readonly page: number
}

/** Whether a manual run may be requested now, or the instant it may. The run slot is `activeRun`'s. */
export type ManualCatalogImportAvailability =
  | { readonly available: true }
  | { readonly available: false; readonly availableAt: Date }

export interface ListCatalogImportRunsOutput {
  readonly runs: CatalogImportRun[]
  readonly page: number
  readonly pageSize: typeof PAGE_SIZE
  readonly total: number
  readonly manualRun: ManualCatalogImportAvailability
  /** The run holding the slot (`requested` or `running`), whatever page is read. */
  readonly activeRun: CatalogImportRun | null
}

export interface IListCatalogImportRunsUseCase {
  execute(input: ListCatalogImportRunsInput): Promise<ListCatalogImportRunsOutput>
}

/**
 * The history of Catalog Import Runs, newest first, in the shared page shape, with what the Run import
 * panel needs: when a manual run may be requested again and the run holding the slot.
 */
export class ListCatalogImportRunsUseCase implements IListCatalogImportRunsUseCase {
  constructor(
    private readonly runRepository: ICatalogImportRunRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: ListCatalogImportRunsInput): Promise<ListCatalogImportRunsOutput> {
    const [{ runs, total }, activeRun, lastManualRequestedAt] = await Promise.all([
      this.runRepository.list((input.page - 1) * PAGE_SIZE, PAGE_SIZE),
      this.runRepository.findActive(),
      this.runRepository.findLatestManualRequestedAt(),
    ])

    return {
      runs,
      page: input.page,
      pageSize: PAGE_SIZE,
      total,
      manualRun: this.availability(lastManualRequestedAt),
      activeRun,
    }
  }

  private availability(lastManualRequestedAt: Date | null): ManualCatalogImportAvailability {
    if (!lastManualRequestedAt) return { available: true }

    const availableAt = new Date(lastManualRequestedAt.getTime() + MANUAL_CATALOG_IMPORT_LIMIT_MS)
    return availableAt.getTime() > this.clock.now().getTime()
      ? { available: false, availableAt }
      : { available: true }
  }
}
