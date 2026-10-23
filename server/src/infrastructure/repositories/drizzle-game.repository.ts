import { eq } from 'drizzle-orm'
import type { CreateGameInput, Game } from '@domain/entities/game.entity'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import { games, type GameRow } from '@infrastructure/database/schema/games'

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
    private readonly clock: Clock
  ) {}

  async findById(id: string): Promise<Game | null> {
    const result = await this.db.select().from(games).where(eq(games.id, id)).limit(1)
    const row = result[0]
    return row ? mapRowToEntity(row) : null
  }

  async findAll(): Promise<Game[]> {
    const result = await this.db.select().from(games)
    return result.map(mapRowToEntity)
  }

  async upsertBySlug(input: CreateGameInput): Promise<Game> {
    const result = await this.db
      .insert(games)
      .values({
        name: input.name,
        slug: input.slug,
        coverUrl: input.coverUrl,
        // Local seeds and upserts have no separate thumbnail art yet: the cover
        // is the thumbnail until the IGDB import supplies a better crop.
        thumbnailUrl: input.coverUrl,
        minPlayers: input.minPlayers,
        maxPlayers: input.maxPlayers,
      })
      .onConflictDoUpdate({
        target: games.slug,
        set: {
          name: input.name,
          coverUrl: input.coverUrl,
          thumbnailUrl: input.coverUrl,
          minPlayers: input.minPlayers,
          maxPlayers: input.maxPlayers,
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
}
