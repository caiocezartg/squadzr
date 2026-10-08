import { vi, type Mock } from 'vitest'
import type { Game } from '@domain/entities/game.entity'
import type { IGameRepository } from '@domain/repositories/game.repository'

export function createMockGame(overrides?: Partial<Game>): Game {
  return {
    id: 'game-uuid-1',
    name: 'League of Legends',
    slug: 'league-of-legends',
    coverUrl: 'https://images.igdb.com/lol.jpg',
    minPlayers: 2,
    maxPlayers: 5,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export type MockGameRepository = {
  [K in keyof IGameRepository]: Mock<IGameRepository[K]>
}

export function createMockGameRepository(): MockGameRepository {
  return {
    findById: vi.fn<(id: string) => Promise<Game | null>>().mockResolvedValue(null),
    findAll: vi.fn<() => Promise<Game[]>>().mockResolvedValue([]),
  }
}
