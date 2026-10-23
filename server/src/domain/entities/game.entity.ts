export interface GameGenre {
  readonly slug: string
  readonly name: string
}

export interface Game {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly igdbId: number | null
  readonly genres: readonly GameGenre[]
  readonly coverUrl: string
  readonly thumbnailUrl: string
  readonly popularity: number
  readonly listed: boolean
  readonly featuredRank: number | null
  readonly minPlayers: number
  readonly maxPlayers: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Full catalog state of an imported game. `listed` is deliberately absent: the
 * Catalog Import relists returning games explicitly, and an upsert must not
 * flip a delisted game back to listed.
 */
export interface UpsertGameInput {
  readonly igdbId: number
  readonly name: string
  readonly slug: string
  readonly genres: readonly GameGenre[]
  readonly coverUrl: string
  readonly thumbnailUrl: string
  readonly popularity: number
  readonly minPlayers: number
  readonly maxPlayers: number
  readonly featuredRank: number | null
}
