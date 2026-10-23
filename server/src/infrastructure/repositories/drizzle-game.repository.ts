import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Game, UpsertGameInput } from '@domain/entities/game.entity'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import { games, type GameRow } from '@infrastructure/database/schema/games'

/**
 * The statements the repository issues, shared by the root connection and a
 * transaction handle so one import can bind every write to the same connection.
 */
type DatabaseExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'execute'>

/**
 * Application-wide key of the advisory lock that serializes Catalog Import
 * transactions. Any run taking it waits for the previous run to commit.
 */
const CATALOG_IMPORT_LOCK_KEY = 89_001

function mapRowToEntity(row: GameRow): Game {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    igdbId: row.igdbId,
    genres: row.genres,
    coverUrl: row.coverUrl,
    thumbnailUrl: row.thumbnailUrl,
    popularity: row.popularity,
    listed: row.listed,
    featuredRank: row.featuredRank,
    minPlayers: row.minPlayers,
    maxPlayers: row.maxPlayers,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleGameRepository implements IGameRepository {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly executor: DatabaseExecutor = db
  ) {}

  async findById(id: string): Promise<Game | null> {
    const result = await this.executor.select().from(games).where(eq(games.id, id)).limit(1)
    const row = result[0]
    return row ? mapRowToEntity(row) : null
  }

  async findAll(): Promise<Game[]> {
    const result = await this.executor.select().from(games)
    return result.map(mapRowToEntity)
  }

  async upsertByIgdbId(input: UpsertGameInput): Promise<Game> {
    const result = await this.executor
      .insert(games)
      .values({
        igdbId: input.igdbId,
        name: input.name,
        slug: input.slug,
        genres: [...input.genres],
        coverUrl: input.coverUrl,
        thumbnailUrl: input.thumbnailUrl,
        popularity: input.popularity,
        minPlayers: input.minPlayers,
        maxPlayers: input.maxPlayers,
        featuredRank: input.featuredRank,
      })
      .onConflictDoUpdate({
        target: games.igdbId,
        set: {
          name: input.name,
          slug: input.slug,
          genres: [...input.genres],
          coverUrl: input.coverUrl,
          thumbnailUrl: input.thumbnailUrl,
          popularity: input.popularity,
          minPlayers: input.minPlayers,
          maxPlayers: input.maxPlayers,
          featuredRank: input.featuredRank,
          updatedAt: this.clock.now(),
        },
      })
      .returning()

    const row = result[0]
    if (!row) {
      throw new Error('Failed to upsert game')
    }
    return mapRowToEntity(row)
  }

  async delistByIgdbIds(igdbIds: readonly number[]): Promise<number> {
    if (igdbIds.length === 0) return 0

    const rows = await this.executor
      .update(games)
      .set({ listed: false, updatedAt: this.clock.now() })
      .where(and(inArray(games.igdbId, [...igdbIds]), eq(games.listed, true)))
      .returning({ id: games.id })

    return rows.length
  }

  async relistByIgdbIds(igdbIds: readonly number[]): Promise<number> {
    if (igdbIds.length === 0) return 0

    const rows = await this.executor
      .update(games)
      .set({ listed: true, updatedAt: this.clock.now() })
      .where(and(inArray(games.igdbId, [...igdbIds]), eq(games.listed, false)))
      .returning({ id: games.id })

    return rows.length
  }

  async acquireCatalogImportLock(): Promise<void> {
    await this.executor.execute(sql`select pg_advisory_xact_lock(${CATALOG_IMPORT_LOCK_KEY})`)
  }

  async runInTransaction<T>(work: (repository: IGameRepository) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(new DrizzleGameRepository(this.db, this.clock, tx)))
  }
}
