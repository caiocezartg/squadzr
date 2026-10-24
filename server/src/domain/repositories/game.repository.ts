import type { Game, PopularGames, UpsertGameInput } from '@domain/entities/game.entity'

export interface SearchGamesInput {
  /** The player's text; empty or absent lists the most popular Listed Games. */
  readonly search?: string
  /** The maximum number of games to return. */
  readonly limit: number
}

export interface FindPopularGamesInput {
  /** The maximum number of games to return. */
  readonly limit: number
  /** The instant the Open Room window is measured from. */
  readonly now: Date
}

export interface IGameRepository {
  findById(id: string): Promise<Game | null>
  findAll(): Promise<Game[]>
  /** Listed Games only: name contains `search`, prefix matches first, then popularity. */
  search(input: SearchGamesInput): Promise<Game[]>
  /**
   * Listed Games ranked by Open Squads descending, then featured rank,
   * popularity and name, with their Open Squad count and most used tags.
   */
  findPopular(input: FindPopularGamesInput): Promise<PopularGames>
  /** Inserts or updates an imported game by its IGDB id. Slugs are not unique. */
  upsertByIgdbId(input: UpsertGameInput): Promise<Game>
  /** Delists the listed imported games with these IGDB ids; returns how many changed. */
  delistByIgdbIds(igdbIds: readonly number[]): Promise<number>
  /** Relists the delisted imported games with these IGDB ids; returns how many changed. */
  relistByIgdbIds(igdbIds: readonly number[]): Promise<number>
  /**
   * Takes a transaction-scoped lock shared by every Catalog Import run. A run
   * waits for the previous one to commit before it reads the catalog, so two
   * concurrent runs cannot both pass the safety checks on a stale count. Call
   * it on the repository handed to `runInTransaction`, before reading.
   */
  acquireCatalogImportLock(): Promise<void>
  /**
   * Runs `work` inside one database transaction and hands it a repository bound
   * to that transaction, so every write commits together or rolls back together.
   * Call it on the root repository only.
   */
  runInTransaction<T>(work: (repository: IGameRepository) => Promise<T>): Promise<T>
}
