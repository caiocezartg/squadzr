import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Game, PopularGames, UpsertGameInput } from '@domain/entities/game.entity'
import type {
  FindPopularGamesInput,
  IGameRepository,
  SearchGamesInput,
} from '@domain/repositories/game.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import {
  buildSearchText,
  normalizeAliases,
  normalizeSearchText,
  SEARCH_TEXT_SEPARATOR,
} from '@domain/services/search-text'
import { games, type GameRow } from '@infrastructure/database/schema/games'
import { rooms } from '@infrastructure/database/schema/rooms'
import { validOpenRoomCondition } from './open-room-rules'

/**
 * The minimum `word_similarity` between a term of five letters or more and a Game's
 * search text for a typo-tolerant match. 0.5 accepts an incomplete term ("valorat")
 * and a wrong letter in a long word ("counetr"), not a transposition in a short one.
 */
const SEARCH_SIMILARITY_THRESHOLD = 0.5

/**
 * The stricter minimum for a term of three or four letters. With 0.5 such a term
 * matches every word that merely starts alike: `word_similarity('lol', 'lost ark')`
 * is 0.5, so "lol" would list Lost Ark next to League of Legends.
 */
const SHORT_TERM_SIMILARITY_THRESHOLD = 0.7

/** Shorter terms match by text only: with 1 or 2 letters similarity matches almost everything. */
const MIN_SIMILARITY_TERM_LENGTH = 3

/** From this length on a term is "long" and uses {@link SEARCH_SIMILARITY_THRESHOLD}. */
const LONG_TERM_LENGTH = 5

/**
 * The `word_similarity` threshold for a normalized term, or `null` when the term
 * matches by text only. It counts characters, not UTF-16 units: an emoji or a
 * rare ideograph is one letter.
 */
function similarityThresholdFor(term: string): number | null {
  const length = [...term].length
  if (length < MIN_SIMILARITY_TERM_LENGTH) return null
  return length < LONG_TERM_LENGTH ? SHORT_TERM_SIMILARITY_THRESHOLD : SEARCH_SIMILARITY_THRESHOLD
}

/**
 * The Listed Games matching a normalized `term`, ranked by how it matched. With
 * `withSimilarity` the caller has set `pg_trgm.word_similarity_threshold` on this
 * connection, which `<%` reads.
 */
async function selectGamesByTerm(
  executor: DatabaseExecutor,
  term: string,
  limit: number,
  withSimilarity: boolean
): Promise<Game[]> {
  const contains = sql`${games.searchText} LIKE ${`%${term}%`}`
  const similarity = sql`word_similarity(${term}, ${games.searchText})`
  const matches = withSimilarity ? sql`(${contains} OR ${term} <% ${games.searchText})` : contains

  const result = await executor
    .select()
    .from(games)
    .where(and(eq(games.listed, true), matches))
    .orderBy(
      sql`CASE
        WHEN ${term} = split_part(${games.searchText}, ${SEARCH_TEXT_SEPARATOR}, 1) OR ${term} = ANY(${games.aliases}) THEN 0
        WHEN starts_with(${games.searchText}, ${term}) THEN 1
        WHEN ${contains} THEN 2
        ELSE 3
      END`,
      sql`CASE WHEN ${contains} THEN 0 ELSE ${similarity} END DESC`,
      desc(games.popularity),
      asc(games.name),
      asc(games.id)
    )
    .limit(limit)

  return result.map(mapRowToEntity)
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
    platforms: row.platforms,
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
    const term = normalizeSearchText(search)
    return term === '' ? this.listSuggestions(limit) : this.searchByTerm(term, limit)
  }

  /** No usable term: the Featured Games first (NULLs last), then the rest by popularity. */
  private async listSuggestions(limit: number): Promise<Game[]> {
    const result = await this.executor
      .select()
      .from(games)
      .where(eq(games.listed, true))
      .orderBy(asc(games.featuredRank), desc(games.popularity), asc(games.name), asc(games.id))
      .limit(limit)

    return result.map(mapRowToEntity)
  }

  /**
   * `term` is already normalized, so it holds no LIKE wildcard. A Game matches
   * when its search text contains the term or, from three letters on, when a word
   * of it is similar enough: 0.7 for three or four letters, 0.5 from five. Results
   * are ranked by how the term matched.
   */
  private async searchByTerm(term: string, limit: number): Promise<Game[]> {
    const threshold = similarityThresholdFor(term)
    if (threshold === null) return selectGamesByTerm(this.executor, term, limit, false)

    // `<%` is the indexable form of `word_similarity(...) >= threshold` and reads its
    // threshold from a setting. `set_config(..., true)` is `SET LOCAL` with a bound
    // value: the setting lasts for this transaction only, so it never leaks into the
    // next user of the pooled connection.
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(threshold)}, true)`
      )
      return selectGamesByTerm(tx, term, limit, true)
    })
  }

  async findPopular({ limit, now }: FindPopularGamesInput): Promise<PopularGames> {
    // Aggregate first, over the Open Rooms only: a Game with no Open Squad
    // never enters this grouping, and the LEFT JOIN below gives it a zero count.
    // JSON keeps each Open Squad's tag array; PostgreSQL's array_agg refuses
    // empty arrays and mixed dimensionalities.
    const openSquads = this.executor
      .select({
        gameId: rooms.gameId,
        openSquadCount: sql<number>`count(*)`.mapWith(Number).as('open_squad_count'),
        roomTags: sql<string[][]>`jsonb_agg(${rooms.tags})`.as('room_tags'),
      })
      .from(rooms)
      .where(validOpenRoomCondition(now))
      .groupBy(rooms.gameId)
      .as('open_squads')

    const openSquadCount = sql<number>`coalesce(${openSquads.openSquadCount}, 0)`.mapWith(Number)
    // One cheap count over the catalog, not a window over every aggregated Game.
    const totalGames =
      sql<number>`(select count(*) from ${games} where ${games.listed} = true)`.mapWith(Number)

    const result = await this.executor
      .select({
        game: games,
        openSquadCount,
        roomTags: sql<string[][]>`coalesce(${openSquads.roomTags}, '[]'::jsonb)`,
        totalGames,
      })
      .from(games)
      .leftJoin(openSquads, eq(openSquads.gameId, games.id))
      .where(eq(games.listed, true))
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
    const aliases = normalizeAliases(input.name, input.aliases)
    const searchText = buildSearchText(input.name, aliases)
    const result = await this.executor
      .insert(games)
      .values({
        igdbId: input.igdbId,
        name: input.name,
        slug: input.slug,
        genres: [...input.genres],
        platforms: [...input.platforms],
        aliases,
        searchText,
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
          platforms: [...input.platforms],
          aliases,
          searchText,
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
