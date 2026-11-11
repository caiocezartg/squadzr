import type { Game } from './game.entity'

/** How a Game is used: its Open Squads now and every Squad that became Ready for it, all time. */
export interface AdminGameUsage {
  readonly openSquads: number
  readonly completedSquads: number
}

/** A catalog Game, listed or not, with its usage. */
export interface AdminGame {
  readonly game: Game
  readonly usage: AdminGameUsage
}

/** The Games a Catalog Import Run changed: how many, and the first few by name. */
export interface AdminGameChange {
  readonly total: number
  readonly games: readonly { readonly id: string; readonly name: string }[]
}

/** The catalog's size by state. `featured` counts Listed Games with a featured rank. */
export interface AdminGameCounts {
  readonly listed: number
  readonly delisted: number
  readonly featured: number
}
