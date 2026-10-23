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

export interface CreateGameInput {
  readonly name: string
  readonly slug: string
  readonly coverUrl: string
  readonly minPlayers: number
  readonly maxPlayers: number
}
