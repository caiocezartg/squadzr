import type { GameSummary } from './game.entity'

/** One member of a Squad's preview: enough to show who joined, never the roster. */
export interface MemberPreview {
  readonly id: string
  readonly name: string
  readonly image: string | null
}

export interface Room {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly hostId: string
  readonly gameId: string
  /** Read together with the Squad, so a projection never looks the Game up again. */
  readonly game: GameSummary
  readonly maxPlayers: number
  readonly discordLink: string | null
  readonly tags: string[]
  readonly language: 'en' | 'pt-br'
  /** Null while the room is open; set when the room reaches capacity. */
  readonly readyAt: Date | null
  /** Advanced only by durable membership changes; feeds open-room expiration. */
  readonly lastActivityAt: Date
  readonly memberCount?: number
  /** Up to five members, host first, then by join time. Read with the Squad. */
  readonly memberPreview: readonly MemberPreview[]
  readonly isMember?: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface NewRoom {
  readonly name: string
  readonly hostId: string
  readonly gameId: string
  readonly maxPlayers: number
  readonly discordLink: string
  readonly tags?: string[]
  readonly language?: 'en' | 'pt-br'
}
