import { PAGE_SIZE } from '@squadzr/schemas'
import type { AuditEntry } from '@domain/entities/audit-entry.entity'
import type { IAuditEntryRepository } from '@domain/repositories/audit-entry.repository'

export interface ListAuditEntriesInput {
  /** 1-based; a page past the end gives no entries and the real total. */
  readonly page: number
}

export interface ListAuditEntriesOutput {
  readonly entries: AuditEntry[]
  readonly page: number
  readonly pageSize: typeof PAGE_SIZE
  readonly total: number
}

export interface IListAuditEntriesUseCase {
  execute(input: ListAuditEntriesInput): Promise<ListAuditEntriesOutput>
}

export class ListAuditEntriesUseCase implements IListAuditEntriesUseCase {
  constructor(private readonly auditEntryRepository: IAuditEntryRepository) {}

  async execute(input: ListAuditEntriesInput): Promise<ListAuditEntriesOutput> {
    const { entries, total } = await this.auditEntryRepository.list(
      (input.page - 1) * PAGE_SIZE,
      PAGE_SIZE
    )

    return { entries, page: input.page, pageSize: PAGE_SIZE, total }
  }
}
