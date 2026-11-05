import { asc, count, desc, eq, max } from 'drizzle-orm'
import type { PlayerStats, PlayerTopGame } from '@domain/entities/squad-record.entity'
import type { ISquadRecordRepository } from '@domain/repositories/squad-record.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { games } from '@infrastructure/database/schema/games'
import { squadRecordMembers, squadRecords } from '@infrastructure/database/schema/squad-records'

/** The Game columns a Player Profile carries; read without looking at `listed`. */
const profileGameColumns = {
  id: games.id,
  name: games.name,
  slug: games.slug,
  coverUrl: games.coverUrl,
  thumbnailUrl: games.thumbnailUrl,
} as const

export class DrizzleSquadRecordRepository implements ISquadRecordRepository {
  constructor(private readonly db: Database) {}

  async getPlayerStats(userId: string, topLimit: number): Promise<PlayerStats> {
    // One aggregate read, one row per Game the person has played (bounded by the
    // catalog), in the profile's order. The totals and the latest Squad fall out of it.
    const lastReadyAt = max(squadRecords.readyAt)
    const rows = await this.db
      .select({ game: profileGameColumns, squads: count(), lastReadyAt })
      .from(squadRecordMembers)
      .innerJoin(squadRecords, eq(squadRecords.id, squadRecordMembers.recordId))
      .innerJoin(games, eq(games.id, squadRecords.gameId))
      .where(eq(squadRecordMembers.userId, userId))
      .groupBy(games.id)
      .orderBy(desc(count()), desc(lastReadyAt), asc(games.name), asc(games.id))

    const perGame: PlayerTopGame[] = rows.flatMap((row) =>
      row.lastReadyAt ? [{ game: row.game, squads: row.squads, lastReadyAt: row.lastReadyAt }] : []
    )
    const latest = perGame.reduce<PlayerTopGame | null>(
      (best, entry) => (best && best.lastReadyAt >= entry.lastReadyAt ? best : entry),
      null
    )

    return {
      completedSquads: perGame.reduce((total, entry) => total + entry.squads, 0),
      gamesPlayed: perGame.length,
      lastSquad: latest ? { game: latest.game, readyAt: latest.lastReadyAt } : null,
      topGames: perGame.slice(0, topLimit),
    }
  }
}
