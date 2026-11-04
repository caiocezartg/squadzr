import type { Platform } from '@squadzr/schemas'
import type { GameGenre } from '@domain/entities/game.entity'

/** Multiplayer capacity as reported by the catalog source (IGDB in production). */
export interface GameMultiplayerCapacity {
  /** Largest online co-op session the game supports; null when unknown. */
  readonly onlineCoopMax: number | null
  /** Largest online session the game supports; null when unknown. */
  readonly onlineMax: number | null
}

/**
 * The raw "who plays this today" numbers a source has for one game. A signal the
 * source does not have is null; turning signals into a score is the Catalog
 * Import's job, never the source's.
 */
export interface GamePopularitySignals {
  /** Players currently playing the game, as the source's own platform counts them. */
  readonly playing: number | null
  /** Highest number of concurrent Steam players over the last 24 hours. */
  readonly steamPeakPlayers: number | null
}

/** One game the Catalog Import may create, update or relist. */
export interface GameCatalogCandidate {
  readonly igdbId: number
  readonly name: string
  readonly slug: string
  readonly genres: readonly GameGenre[]
  /** Supported platforms in display order; empty when the source lists none of them. */
  readonly platforms: readonly Platform[]
  readonly coverUrl: string
  readonly thumbnailUrl: string
  readonly multiplayer: GameMultiplayerCapacity
  readonly popularitySignals: GamePopularitySignals
}

/** One candidate list as fetched by a source, plus what it could not use. */
export interface GameCatalogFetchResult {
  /** Every usable candidate, fetched fresh on every run. */
  readonly candidates: readonly GameCatalogCandidate[]
  /** Entries discarded by the source because a required field was missing. */
  readonly invalid: number
}

/**
 * The only seam between the Catalog Import and where games come from. The
 * production implementation queries IGDB (CCC-90); tests use a fake source.
 */
export interface IGameCatalogSource {
  /** Every candidate the source currently knows, fetched fresh on every run. */
  fetchCandidates(): Promise<GameCatalogFetchResult>
}
