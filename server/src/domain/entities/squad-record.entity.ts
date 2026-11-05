/** A Game as the Player Profile shows it: no genres, no aliases. */
export interface ProfileGame {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly coverUrl: string
  readonly thumbnailUrl: string
}

export interface PlayerTopGame {
  readonly game: ProfileGame
  /** Squad Records of this Game the person is a member of. */
  readonly squads: number
  /** When the most recent of them became Ready. */
  readonly lastReadyAt: Date
}

/** What a person's Squad Records add up to. */
export interface PlayerStats {
  readonly completedSquads: number
  readonly gamesPlayed: number
  readonly lastSquad: { readonly game: ProfileGame; readonly readyAt: Date } | null
  readonly topGames: readonly PlayerTopGame[]
}
