import { PAGE_SIZE } from '@squadzr/schemas'
import type { CatalogImportRun } from '@domain/entities/catalog-import-run.entity'
import type { ICatalogImportRunRepository } from '@domain/repositories/catalog-import-run.repository'

export interface ListCatalogImportRunsInput {
  /** 1-based; a page past the end gives no runs and the real total. */
  readonly page: number
}

export interface ListCatalogImportRunsOutput {
  readonly runs: CatalogImportRun[]
  readonly page: number
  readonly pageSize: typeof PAGE_SIZE
  readonly total: number
}

export interface IListCatalogImportRunsUseCase {
  execute(input: ListCatalogImportRunsInput): Promise<ListCatalogImportRunsOutput>
}

/** The history of Catalog Import Runs, newest first, in the shared page shape. */
export class ListCatalogImportRunsUseCase implements IListCatalogImportRunsUseCase {
  constructor(private readonly runRepository: ICatalogImportRunRepository) {}

  async execute(input: ListCatalogImportRunsInput): Promise<ListCatalogImportRunsOutput> {
    const { runs, total } = await this.runRepository.list((input.page - 1) * PAGE_SIZE, PAGE_SIZE)

    return { runs, page: input.page, pageSize: PAGE_SIZE, total }
  }
}
