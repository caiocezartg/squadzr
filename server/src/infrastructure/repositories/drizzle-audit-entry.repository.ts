import { count, desc } from 'drizzle-orm'
import type { AuditEntry } from '@domain/entities/audit-entry.entity'
import type {
  AuditEntryPage,
  IAuditEntryRepository,
} from '@domain/repositories/audit-entry.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { auditEntries, type AuditEntryRow } from '@infrastructure/database/schema/audit-entries'

function mapRowToEntity(row: AuditEntryRow): AuditEntry {
  return {
    id: row.id,
    actorId: row.actorId,
    actorName: row.actorName,
    // The column is a varchar and a check constraint keeps it to the known actions.
    action: row.action as AuditEntry['action'],
    target: row.target,
    reason: row.reason,
    details: row.details,
    createdAt: row.createdAt,
  }
}

export class DrizzleAuditEntryRepository implements IAuditEntryRepository {
  constructor(private readonly db: Database) {}

  async list(offset: number, limit: number): Promise<AuditEntryPage> {
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(auditEntries)
        .orderBy(desc(auditEntries.createdAt), desc(auditEntries.id))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(auditEntries),
    ])

    return { entries: rows.map(mapRowToEntity), total: totals[0]?.total ?? 0 }
  }
}
