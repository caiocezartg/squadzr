import type { UserRole } from '@squadzr/schemas'
import type { ProfileGame } from './squad-record.entity'

/** A person as the admin panel sees them: never the email, and the Discord id the account holds. */
export interface AdminUser {
  readonly id: string
  readonly name: string
  readonly avatarUrl: string | null
  /** The account id of the user's Discord account; null for a user without one. */
  readonly discordId: string | null
  readonly role: UserRole
  readonly createdAt: Date
}

export interface AdminUserListItem extends AdminUser {
  /** Memberships in valid Open Squads, the hosted ones included (the Squad Limits count). */
  readonly openSquads: number
}

/** An Open Squad the person is in right now. */
export interface AdminUserOpenSquad {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly game: ProfileGame
  readonly memberCount: number
  readonly maxPlayers: number
  readonly isHost: boolean
}

/** A completed Squad, from its Squad Record. */
export interface AdminUserCompletedSquad {
  readonly id: string
  readonly name: string
  readonly game: ProfileGame
  readonly maxPlayers: number
  readonly readyAt: Date
}
