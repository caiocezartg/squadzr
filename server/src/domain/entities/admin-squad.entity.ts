import type { Platform } from '@squadzr/schemas'

/** One Open Squad as the admin list shows it. No email of anybody. */
export interface AdminSquad {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly game: { readonly id: string; readonly name: string; readonly coverThumbUrl: string }
  readonly platform: Platform | null
  readonly host: { readonly id: string; readonly name: string }
  readonly memberCount: number
  readonly maxPlayers: number
  readonly createdAt: Date
  readonly lastActivityAt: Date
}

export interface AdminSquadMember {
  readonly id: string
  readonly name: string
  readonly image: string | null
  readonly isHost: boolean
  readonly joinedAt: Date
}

/** An Open Squad with its roster and full Discord invite, for the side panel. */
export interface AdminSquadDetail extends AdminSquad {
  readonly language: 'en' | 'pt-br'
  readonly discordLink: string | null
  /** The host first, then by join time. */
  readonly members: readonly AdminSquadMember[]
}

/** What an Admin Closure knows about the Squad it deletes, read under the Squad lock. */
export interface ClosedSquad {
  readonly roomId: string
  readonly roomCode: string
  readonly roomName: string
  readonly gameName: string
  /** Absent when the Game has no cover. */
  readonly gameCoverUrl?: string
  /** Every member, the host included. */
  readonly memberIds: readonly string[]
}
