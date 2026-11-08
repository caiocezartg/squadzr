import type { UserNotification } from '@domain/entities/user-notification.entity'
import type { IAdminSquadRepository } from '@domain/repositories/admin-squad.repository'
import { RoomNotFoundError, RoomNotOpenError } from '@application/errors'
import {
  buildAdminClosureAuditEntry,
  buildAdminClosureNotifications,
  type ClosureActor,
} from './helpers/admin-closure-records'

export interface CloseSquadInput {
  readonly roomId: string
  /** Already trimmed and checked against the 3 to 280 character rule by the contract. */
  readonly reason: string
  readonly actor: ClosureActor
}

export interface CloseSquadOutput {
  readonly roomId: string
  readonly roomCode: string
  /** Persisted by the closure, one per member, for the push after commit. */
  readonly notifications: readonly UserNotification[]
}

export interface ICloseSquadUseCase {
  execute(input: CloseSquadInput): Promise<CloseSquadOutput>
}

/**
 * Admin Closure: an admin closes an Open Squad with a reason. The repository locks the Squad, checks it
 * is still open, deletes it and persists every member's notification and the Audit Entry in one
 * transaction; this use case supplies the pure builders for those records and maps the refusals.
 */
export class CloseSquadUseCase implements ICloseSquadUseCase {
  constructor(private readonly adminSquadRepository: IAdminSquadRepository) {}

  async execute(input: CloseSquadInput): Promise<CloseSquadOutput> {
    const outcome = await this.adminSquadRepository.closeOpenSquad({
      roomId: input.roomId,
      buildNotifications: (squad) => buildAdminClosureNotifications(squad, input.reason),
      buildAuditEntry: buildAdminClosureAuditEntry(input.actor, input.reason),
    })

    switch (outcome.status) {
      case 'closed':
        return {
          roomId: outcome.roomId,
          roomCode: outcome.roomCode,
          notifications: outcome.notifications,
        }
      case 'not_found':
        throw new RoomNotFoundError(input.roomId)
      case 'not_open':
        throw new RoomNotOpenError(input.roomId)
    }
  }
}
