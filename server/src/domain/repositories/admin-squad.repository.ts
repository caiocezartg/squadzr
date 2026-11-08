import type { AdminSquad, AdminSquadDetail, ClosedSquad } from '@domain/entities/admin-squad.entity'
import type { NewAuditEntry } from '@domain/entities/audit-entry.entity'
import type {
  CreateUserNotificationInput,
  UserNotification,
} from '@domain/entities/user-notification.entity'

export interface ListOpenSquadsQuery {
  readonly offset: number
  readonly limit: number
  /** Matches the Squad's name or code, or the host's name; blank or absent is no filter. */
  readonly search?: string
  readonly gameId?: string
}

export interface OpenSquadPage {
  readonly squads: AdminSquad[]
  /** Every Open Squad that matches, not only this page's. */
  readonly total: number
}

export interface CloseOpenSquadInput {
  readonly roomId: string
  /**
   * Pure builders called with the Squad as it stands under the lock, which must not do I/O: a failure
   * to persist what they return rolls the whole closure back.
   */
  readonly buildNotifications: (squad: ClosedSquad) => readonly CreateUserNotificationInput[]
  readonly buildAuditEntry: (squad: ClosedSquad, closedAt: Date) => NewAuditEntry
}

export type CloseOpenSquadOutcome =
  | {
      readonly status: 'closed'
      readonly roomId: string
      readonly roomCode: string
      /** The notifications this closure inserted, for the post-commit push. */
      readonly notifications: readonly UserNotification[]
    }
  | { readonly status: 'not_found' }
  /** The Squad is Ready or its Room Activity window ended. */
  | { readonly status: 'not_open' }

export interface IAdminSquadRepository {
  /** Open Squads (the validity rule of the Squad Limits) newest first. */
  listOpen(query: ListOpenSquadsQuery): Promise<OpenSquadPage>
  /** The Open Squad with that id, or null when it is unknown, Ready or expired. */
  findOpenById(id: string): Promise<AdminSquadDetail | null>
  /**
   * Admin Closure in one transaction: locks the Squad row (the lock the leave path takes), checks it is
   * still open, deletes it (its Memberships cascade), persists one notification per member and the
   * Audit Entry, reading the clock after the lock.
   */
  closeOpenSquad(input: CloseOpenSquadInput): Promise<CloseOpenSquadOutcome>
}
