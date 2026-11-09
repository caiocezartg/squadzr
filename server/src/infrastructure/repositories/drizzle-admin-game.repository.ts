import { normalizeSearchText, type AdminGameSort, type AdminGameStatus } from '@squadzr/schemas'
import { and, asc, count, desc, eq, gte, isNotNull, lte, sql, type SQL } from 'drizzle-orm'
import type {
  AdminGame,
  AdminGameChange,
  AdminGameCounts,
} from '@domain/entities/admin-game.entity'
import type {
  AdminGameChanges,
  AdminGamePage,
  IAdminGameRepository,
  ImportWindow,
  ListAdminGamesQuery,
} from '@domain/repositories/admin-game.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import { games, type GameRow } from '@infrastructure/database/schema/games'
import { rooms } from '@infrastructure/database/schema/rooms'
import { squadRecords } from '@infrastructure/database/schema/squad-records'
import { validOpenRoomCondition } from './open-room-rules'

/** The Listed Games with a featured rank: the highlights players see. */
const featuredCondition = and(eq(games.listed, true), isNotNull(games.featuredRank))

function statusCondition(status: AdminGameStatus): SQL | undefined {
  if (status === 'listed') return eq(games.listed, true)
  if (status === 'delisted') return eq(games.listed, false)
  if (status === 'featured') return featuredCondition
  return undefined
}

/** The folded term as a `LIKE` over the trigram-indexed search text; nothing when no term is left. */
function searchCondition(search: string | undefined): SQL | undefined {
  const term = search === undefined ? '' : normalizeSearchText(search)
  return term === '' ? undefined : sql`${games.searchText} LIKE ${`%${term}%`}`
}

function mapRow(row: GameRow, openSquads: number, completedSquads: number): AdminGame {
  return {
    game: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      igdbId: row.igdbId,
      genres: row.genres,
      aliases: row.aliases,
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
    },
    usage: { openSquads, completedSquads },
  }
}

export class DrizzleAdminGameRepository implements IAdminGameRepository {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock
  ) {}

  /** Open Squads per Game, grouped once so a page of Games is one query, not one per Game. */
  private openUsage() {
    return this.db
      .select({ gameId: rooms.gameId, openSquads: count().as('open_squads') })
      .from(rooms)
      .where(validOpenRoomCondition(this.clock.now()))
      .groupBy(rooms.gameId)
      .as('open_usage')
  }

  private completedUsage() {
    return this.db
      .select({ gameId: squadRecords.gameId, completedSquads: count().as('completed_squads') })
      .from(squadRecords)
      .groupBy(squadRecords.gameId)
      .as('completed_usage')
  }

  async list(query: ListAdminGamesQuery): Promise<AdminGamePage> {
    const where = and(statusCondition(query.status), searchCondition(query.search))
    const open = this.openUsage()
    const completed = this.completedUsage()
    const openCount = sql<number>`coalesce(${open.openSquads}, 0)::int`
    const completedCount = sql<number>`coalesce(${completed.completedSquads}, 0)::int`

    // Each order ends on the Game id, which no two rows share, so a page boundary never splits a tie.
    const orderings: Record<AdminGameSort, readonly SQL[]> = {
      popularity: [desc(games.popularity), asc(games.name), asc(games.id)],
      name: [asc(games.name), asc(games.id)],
      newest: [desc(games.createdAt), asc(games.id)],
      openSquads: [desc(openCount), desc(games.popularity), asc(games.id)],
      completedSquads: [desc(completedCount), desc(games.popularity), asc(games.id)],
    }

    const [rows, totals] = await Promise.all([
      this.db
        .select({ game: games, openSquads: openCount, completedSquads: completedCount })
        .from(games)
        .leftJoin(open, eq(open.gameId, games.id))
        .leftJoin(completed, eq(completed.gameId, games.id))
        .where(where)
        .orderBy(...orderings[query.sort])
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ total: count() }).from(games).where(where),
    ])

    return {
      games: rows.map((row) => mapRow(row.game, row.openSquads, row.completedSquads)),
      total: totals[0]?.total ?? 0,
    }
  }

  async findById(id: string): Promise<AdminGame | null> {
    const [rows, openRows, completedRows] = await Promise.all([
      this.db.select().from(games).where(eq(games.id, id)).limit(1),
      this.db
        .select({ total: count() })
        .from(rooms)
        .where(and(eq(rooms.gameId, id), validOpenRoomCondition(this.clock.now()))),
      this.db.select({ total: count() }).from(squadRecords).where(eq(squadRecords.gameId, id)),
    ])
    const row = rows[0]
    if (!row) return null

    return mapRow(row, openRows[0]?.total ?? 0, completedRows[0]?.total ?? 0)
  }

  async count(): Promise<AdminGameCounts> {
    const rows = await this.db
      .select({
        listed: sql<number>`count(*) filter (where ${games.listed})::int`,
        delisted: sql<number>`count(*) filter (where not ${games.listed})::int`,
        featured: sql<number>`count(*) filter (where ${games.listed} and ${games.featuredRank} is not null)::int`,
      })
      .from(games)

    return rows[0] ?? { listed: 0, delisted: 0, featured: 0 }
  }

  async findChanges(window: ImportWindow, nameLimit: number): Promise<AdminGameChanges> {
    const entered = and(gte(games.createdAt, window.from), lte(games.createdAt, window.to))
    // A delist bumps `updated_at`, so a Game that is delisted and last changed in the window left in it.
    const left = and(
      eq(games.listed, false),
      gte(games.updatedAt, window.from),
      lte(games.updatedAt, window.to)
    )

    const [enteredChange, leftChange] = await Promise.all([
      this.readChange(entered, nameLimit),
      this.readChange(left, nameLimit),
    ])

    return { entered: enteredChange, left: leftChange }
  }

  private async readChange(where: SQL | undefined, nameLimit: number): Promise<AdminGameChange> {
    const [names, totals] = await Promise.all([
      this.db
        .select({ id: games.id, name: games.name })
        .from(games)
        .where(where)
        .orderBy(asc(games.name), asc(games.id))
        .limit(nameLimit),
      this.db.select({ total: count() }).from(games).where(where),
    ])

    return { total: totals[0]?.total ?? 0, games: names }
  }
}
