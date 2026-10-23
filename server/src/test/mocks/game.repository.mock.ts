import { vi, type Mock } from 'vitest'
import type { Game, UpsertGameInput } from '@domain/entities/game.entity'
import type { IGameRepository } from '@domain/repositories/game.repository'

export function createMockGame(overrides?: Partial<Game>): Game {
  return {
    id: 'game-uuid-1',
    name: 'League of Legends',
    slug: 'league-of-legends',
    igdbId: null,
    genres: [],
    coverUrl: 'https://images.igdb.com/lol.jpg',
    thumbnailUrl: 'https://images.igdb.com/lol.jpg',
    popularity: 0,
    listed: true,
    featuredRank: null,
    minPlayers: 2,
    maxPlayers: 5,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export type MockGameRepository = {
  [K in Exclude<keyof IGameRepository, 'runInTransaction'>]: Mock<IGameRepository[K]>
} & {
  // The generic signature must survive the mock: use cases type the callback
  // result, so a plain Mock would widen it to unknown.
  runInTransaction: IGameRepository['runInTransaction'] & Mock<IGameRepository['runInTransaction']>
}

export function createMockGameRepository(): MockGameRepository {
  const repository: MockGameRepository = {
    findById: vi.fn<(id: string) => Promise<Game | null>>().mockResolvedValue(null),
    findAll: vi.fn<() => Promise<Game[]>>().mockResolvedValue([]),
    upsertByIgdbId: vi.fn<(input: UpsertGameInput) => Promise<Game>>().mockImplementation((input) =>
      Promise.resolve(
        createMockGame({
          igdbId: input.igdbId,
          name: input.name,
          slug: input.slug,
          genres: input.genres,
          coverUrl: input.coverUrl,
          thumbnailUrl: input.thumbnailUrl,
          popularity: input.popularity,
          minPlayers: input.minPlayers,
          maxPlayers: input.maxPlayers,
          featuredRank: input.featuredRank,
        })
      )
    ),
    delistByIgdbIds: vi.fn<(igdbIds: readonly number[]) => Promise<number>>().mockResolvedValue(0),
    relistByIgdbIds: vi.fn<(igdbIds: readonly number[]) => Promise<number>>().mockResolvedValue(0),
    runInTransaction: vi.fn() as unknown as MockGameRepository['runInTransaction'],
  }

  repository.runInTransaction.mockImplementation((work) => work(repository))

  return repository
}
