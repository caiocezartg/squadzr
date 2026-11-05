import type { NewAuditEntry } from '@domain/entities/audit-entry.entity'
import type { Database } from '@infrastructure/database/drizzle'
import { auditEntries } from '@infrastructure/database/schema/audit-entries'

/** The part of a database handle or a transaction that can insert, which both satisfy. */
export type AuditWriter = Pick<Database, 'insert'>

/**
 * Appends one Audit Entry. Every admin write calls it with its own transaction, so the change and its
 * entry commit together; nothing in the app updates or deletes an entry.
 */
export async function insertAuditEntry(writer: AuditWriter, entry: NewAuditEntry): Promise<void> {
  await writer.insert(auditEntries).values({
    actorId: entry.actorId,
    actorName: entry.actorName,
    action: entry.action,
    target: entry.target,
    reason: entry.reason,
    details: entry.details,
    createdAt: entry.createdAt,
  })
}
