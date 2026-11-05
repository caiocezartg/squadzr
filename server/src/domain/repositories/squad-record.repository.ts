import type { PlayerStats } from '@domain/entities/squad-record.entity'

export interface ISquadRecordRepository {
  /**
   * What a person's Squad Records add up to: how many Squads they completed, in how many
   * Games, the latest one and their `topLimit` most played Games (by Squads, then by the
   * latest Ready, then by Game name). A Game that left the catalog is still counted.
   */
  getPlayerStats(userId: string, topLimit: number): Promise<PlayerStats>
}
