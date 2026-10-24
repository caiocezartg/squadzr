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

/** One entry of the landing's popular games list. */
export interface PopularGame {
  readonly game: Game
  /** Open Squads on this Game at the instant the list was read. */
  readonly openSquadCount: number
  /** At most three tags, ranked by use across the Open Squads, then alphabetically. */
  readonly topTags: string[]
}

export interface PopularGames {
  /** Every Listed Game in the catalog, not just the returned page. */
  readonly totalGames: number
  readonly games: PopularGame[]
}

/**
 * The Game fields a Squad carries so a client can render its game without a
 * second read. Legacy Games (no IGDB identity, empty genres) have the same shape.
 */
export type GameSummary = Pick<
  Game,
  'id' | 'name' | 'slug' | 'genres' | 'coverUrl' | 'thumbnailUrl'
>

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
