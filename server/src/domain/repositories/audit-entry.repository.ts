import type { AuditEntry } from '@domain/entities/audit-entry.entity'

export interface AuditEntryPage {
  readonly entries: AuditEntry[]
  /** Every entry there is, not only this page's. */
  readonly total: number
}

export interface IAuditEntryRepository {
  /** Entries newest first, `limit` of them after `offset`; a window past the end is empty. */
  list(offset: number, limit: number): Promise<AuditEntryPage>
}
