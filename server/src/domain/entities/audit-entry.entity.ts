import type { AuditAction, AuditDetails, AuditTarget } from '@squadzr/schemas'

/**
 * The append-only account of one admin action. The actor and the target are snapshots, so the entry
 * reads the same after the person or the Squad is gone. `actorId` is null once the admin's account is
 * deleted; `actorName` is null for an action nobody took through the panel (the grant script).
 */
export interface AuditEntry {
  readonly id: string
  readonly actorId: string | null
  readonly actorName: string | null
  readonly action: AuditAction
  readonly target: AuditTarget | null
  readonly reason: string | null
  readonly details: AuditDetails | null
  readonly createdAt: Date
}

export type NewAuditEntry = Omit<AuditEntry, 'id'>
