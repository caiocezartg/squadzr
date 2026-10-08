import { eq } from 'drizzle-orm'
import type { Game } from '@domain/entities/game.entity'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { games, type GameRow } from '@infrastructure/database/schema/games'

function mapRowToEntity(row: GameRow): Game {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    coverUrl: row.coverUrl,
    minPlayers: row.minPlayers,
    maxPlayers: row.maxPlayers,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleGameRepository implements IGameRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Game | null> {
    const result = await this.db.select().from(games).where(eq(games.id, id)).limit(1)
    const row = result[0]
    return row ? mapRowToEntity(row) : null
  }

  async findAll(): Promise<Game[]> {
    const result = await this.db.select().from(games)
    return result.map(mapRowToEntity)
  }
}
