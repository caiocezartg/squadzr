import { vi, type Mock } from 'vitest'
import type { Room, CreateRoomInput, UpdateRoomInput } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'

export function createMockRoom(overrides?: Partial<Room>): Room {
  return {
    id: 'room-uuid-1',
    code: 'ABC123',
    name: 'Test Room',
    hostId: 'user-uuid-1',
    gameId: 'game-uuid-1',
    maxPlayers: 5,
    discordLink: null,
    tags: [],
    language: 'pt-br' as const,
    readyAt: null,
    lastActivityAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export type MockRoomRepository = {
  [K in keyof IRoomRepository]: Mock<IRoomRepository[K]>
}

export function createMockRoomRepository(): MockRoomRepository {
  return {
    findById: vi.fn<(id: string) => Promise<Room | null>>().mockResolvedValue(null),
    findByCode: vi.fn<(code: string) => Promise<Room | null>>().mockResolvedValue(null),
    findByHostId: vi.fn<(hostId: string) => Promise<Room[]>>().mockResolvedValue([]),
    findAll: vi.fn<() => Promise<Room[]>>().mockResolvedValue([]),
    findAvailable: vi.fn<() => Promise<Room[]>>().mockResolvedValue([]),
    countActiveByHostId: vi.fn<(hostId: string) => Promise<number>>().mockResolvedValue(0),
    findMyRooms: vi
      .fn<(userId: string) => Promise<{ hosted: Room[]; joined: Room[] }>>()
      .mockResolvedValue({ hosted: [], joined: [] }),
    create: vi.fn<(input: CreateRoomInput) => Promise<Room>>().mockImplementation((input) =>
      Promise.resolve(
        createMockRoom({
          name: input.name,
          hostId: input.hostId,
          gameId: input.gameId,
          maxPlayers: input.maxPlayers ?? 5,
          discordLink: input.discordLink ?? null,
          tags: input.tags ?? [],
          language: (input.language ?? 'pt-br') as 'en' | 'pt-br',
        })
      )
    ),
    findExpiredRooms: vi.fn<(beforeDate: Date) => Promise<Room[]>>().mockResolvedValue([]),
    update: vi
      .fn<(id: string, input: UpdateRoomInput) => Promise<Room | null>>()
      .mockResolvedValue(null),
    delete: vi.fn<(id: string) => Promise<boolean>>().mockResolvedValue(false),
  }
}
