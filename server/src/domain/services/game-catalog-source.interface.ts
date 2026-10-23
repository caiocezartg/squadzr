import type { GameGenre } from '@domain/entities/game.entity'

/** Multiplayer capacity as reported by the catalog source (IGDB in production). */
export interface GameMultiplayerCapacity {
  /** Largest online co-op session the game supports; null when unknown. */
  readonly onlineCoopMax: number | null
  /** Largest online session the game supports; null when unknown. */
  readonly onlineMax: number | null
}

/** One game the Catalog Import may create, update or relist. */
export interface GameCatalogCandidate {
  readonly igdbId: number
  readonly name: string
  readonly slug: string
  readonly genres: readonly GameGenre[]
  readonly coverUrl: string
  readonly thumbnailUrl: string
  readonly multiplayer: GameMultiplayerCapacity
  readonly popularity: number
}

/**
 * The only seam between the Catalog Import and where games come from. The
 * production implementation queries IGDB (CCC-90); tests use a fake source.
 */
export interface IGameCatalogSource {
  /** Every candidate the source currently knows, fetched fresh on every run. */
  fetchCandidates(): Promise<GameCatalogCandidate[]>
}
