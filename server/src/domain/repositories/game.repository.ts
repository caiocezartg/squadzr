import type { Game, PopularGames, UpsertGameInput } from '@domain/entities/game.entity'

export interface SearchGamesInput {
  /** The player's text; empty, absent or only punctuation lists the Featured Games first, then by popularity. */
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
  /**
   * Listed Games only. With `search`: the term, the names and the aliases are
   * folded (no case, accents or punctuation); a Game matches when its text
   * contains the term or is similar to it: 1 to 2 characters never use
   * similarity, 3 to 4 need a `word_similarity` of 0.7, 5 or more need 0.5.
   * Ranked exact name or alias, name prefix, contains, similarity only, then
   * popularity, name and id. Without a term (absent, blank or only punctuation): featured rank
   * (unranked last), then popularity.
   */
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
