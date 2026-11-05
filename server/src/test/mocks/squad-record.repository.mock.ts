import { vi, type Mock } from 'vitest'
import type { PlayerStats } from '@domain/entities/squad-record.entity'
import type { ISquadRecordRepository } from '@domain/repositories/squad-record.repository'

export function createMockPlayerStats(overrides?: Partial<PlayerStats>): PlayerStats {
  return { completedSquads: 0, gamesPlayed: 0, lastSquad: null, topGames: [], ...overrides }
}

export type MockSquadRecordRepository = {
  [K in keyof ISquadRecordRepository]: Mock<ISquadRecordRepository[K]>
}

export function createMockSquadRecordRepository(): MockSquadRecordRepository {
  return {
    getPlayerStats: vi
      .fn<(userId: string, topLimit: number) => Promise<PlayerStats>>()
      .mockResolvedValue(createMockPlayerStats()),
  }
}
