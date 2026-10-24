import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Game, PopularGames, UpsertGameInput } from '@domain/entities/game.entity'
import type {
  FindPopularGamesInput,
  IGameRepository,
  SearchGamesInput,
} from '@domain/repositories/game.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import { games, type GameRow } from '@infrastructure/database/schema/games'
import { rooms } from '@infrastructure/database/schema/rooms'
import { validOpenRoomCondition } from './open-room-rules'

/** PostgreSQL's default LIKE escape character. */
const LIKE_ESCAPE = '\\'

/**
 * Makes `%`, `_` and the escape character literal in a LIKE pattern, so a
 * player searching for "100%" or "half_life" finds those characters as typed.
 */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `${LIKE_ESCAPE}${character}`)
}

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

/** How many tags the landing shows next to a Game. */
const POPULAR_GAME_TAG_LIMIT = 3

/**
 * Ranks the tags of a Game's Open Squads by how many Squads use them, then
 * alphabetically, and keeps the first three. A Squad that repeats a tag still
 * counts as one use.
 */
function rankTopTags(roomTags: readonly (readonly string[])[]): string[] {
  const uses = new Map<string, number>()
  for (const tags of roomTags) {
    for (const tag of new Set(tags)) uses.set(tag, (uses.get(tag) ?? 0) + 1)
  }

  return [...uses.entries()]
    .sort(([leftTag, leftUses], [rightTag, rightUses]) => {
      if (leftUses !== rightUses) return rightUses - leftUses
      if (leftTag === rightTag) return 0
      return leftTag < rightTag ? -1 : 1
    })
    .slice(0, POPULAR_GAME_TAG_LIMIT)
    .map(([tag]) => tag)
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

  async search({ search = '', limit }: SearchGamesInput): Promise<Game[]> {
    const term = search.trim()
    // ILIKE compares case-insensitively; the pattern escapes wildcards so the
    // player's `%` and `_` match themselves.
    const contains = `%${escapeLikeTerm(term)}%`

    const result = await this.executor
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

  async findPopular({ limit, now }: FindPopularGamesInput): Promise<PopularGames> {
    // One read: the Open Squads are aggregated per Game in the same statement
    // that ranks the page, and the window count returns the full Listed total
    // even though `limit` cuts the rows.
    const openSquadCount = sql<number>`count(${rooms.id})`.mapWith(Number)
    const totalGames = sql<number>`count(*) over ()`.mapWith(Number)
    // JSON keeps the tag arrays of every Open Squad as a flat list of arrays;
    // PostgreSQL's array_agg refuses empty arrays and mixed dimensionalities.
    const roomTags = sql<
      string[][]
    >`coalesce(jsonb_agg(${rooms.tags}) filter (where ${rooms.id} is not null), '[]'::jsonb)`

    const result = await this.executor
      .select({ game: games, openSquadCount, totalGames, roomTags })
      .from(games)
      .leftJoin(rooms, and(eq(rooms.gameId, games.id), validOpenRoomCondition(now)))
      .where(eq(games.listed, true))
      .groupBy(games.id)
      .orderBy(
        desc(openSquadCount),
        // PostgreSQL sorts ascending NULLs last, so the Featured Games fill the
        // list first on a quiet day and the rest follow by popularity and name.
        asc(games.featuredRank),
        desc(games.popularity),
        asc(games.name),
        asc(games.id)
      )
      .limit(limit)

    return {
      totalGames: result[0]?.totalGames ?? 0,
      games: result.map((row) => ({
        game: mapRowToEntity(row.game),
        openSquadCount: row.openSquadCount,
        topTags: rankTopTags(row.roomTags),
      })),
    }
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
