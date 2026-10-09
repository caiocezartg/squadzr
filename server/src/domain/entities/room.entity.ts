export interface Room {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly hostId: string
  readonly gameId: string
  readonly maxPlayers: number
  readonly discordLink: string | null
  readonly tags: string[]
  readonly language: 'en' | 'pt-br'
  /** Null while the room is open; set when the room reaches capacity. */
  readonly readyAt: Date | null
  /** Advanced only by durable membership changes; feeds open-room expiration. */
  readonly lastActivityAt: Date
  readonly memberCount?: number
  readonly isMember?: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface CreateRoomInput {
  readonly name: string
  readonly hostId: string
  readonly gameId: string
  readonly maxPlayers: number
  readonly discordLink: string
  readonly tags?: string[]
  readonly language?: 'en' | 'pt-br'
}
