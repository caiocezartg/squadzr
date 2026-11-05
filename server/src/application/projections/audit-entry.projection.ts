import type { AuditEntryDto } from '@squadzr/schemas'
import type { AuditEntry } from '@domain/entities/audit-entry.entity'

export function toAuditEntryDto(entry: AuditEntry): AuditEntryDto {
  return {
    id: entry.id,
    action: entry.action,
    actorId: entry.actorId,
    actorName: entry.actorName,
    target: entry.target,
    reason: entry.reason,
    details: entry.details,
    createdAt: entry.createdAt.toISOString(),
  }
}
