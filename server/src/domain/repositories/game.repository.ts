import type { Game, UpsertGameInput } from '@domain/entities/game.entity'

export interface IGameRepository {
  findById(id: string): Promise<Game | null>
  findAll(): Promise<Game[]>
  /** Inserts or updates an imported game by its IGDB id. Slugs are not unique. */
  upsertByIgdbId(input: UpsertGameInput): Promise<Game>
  /** Delists the listed imported games with these IGDB ids; returns how many changed. */
  delistByIgdbIds(igdbIds: readonly number[]): Promise<number>
  /** Relists the delisted imported games with these IGDB ids; returns how many changed. */
  relistByIgdbIds(igdbIds: readonly number[]): Promise<number>
  /**
   * Runs `work` inside one database transaction and hands it a repository bound
   * to that transaction, so every write commits together or rolls back together.
   * Call it on the root repository only.
   */
  runInTransaction<T>(work: (repository: IGameRepository) => Promise<T>): Promise<T>
}
