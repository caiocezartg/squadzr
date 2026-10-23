import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { CreateGameInput, Game } from '@domain/entities/game.entity'
import type { IGameRepository, SearchGamesInput } from '@domain/repositories/game.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import { games, type GameRow } from '@infrastructure/database/schema/games'

/** PostgreSQL's default LIKE escape character. */
const LIKE_ESCAPE = '\\'

/**
 * Makes `%`, `_` and the escape character literal in a LIKE pattern, so a
 * player searching for "100%" or "half_life" finds those characters as typed.
 */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `${LIKE_ESCAPE}${character}`)
}

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

  async search({ search = '', limit }: SearchGamesInput): Promise<Game[]> {
    const term = search.trim()
    // ILIKE compares case-insensitively; the pattern escapes wildcards so the
    // player's `%` and `_` match themselves.
    const contains = `%${escapeLikeTerm(term)}%`

    const result = await this.db
      .select()
      .from(games)
      .where(
        term === ''
          ? eq(games.listed, true)
          : and(eq(games.listed, true), sql`${games.name} ILIKE ${contains} ESCAPE ${LIKE_ESCAPE}`)
      )
      .orderBy(
        // A name that starts with the term comes before one that contains it
        // later. `starts_with` compares text literally, so no escaping here.
        term === ''
          ? desc(games.popularity)
          : sql`CASE WHEN starts_with(lower(${games.name}), lower(${term})) THEN 0 ELSE 1 END`,
        desc(games.popularity),
        asc(games.name),
        asc(games.id)
      )
      .limit(limit)

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
