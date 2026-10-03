import { vi, type Mock } from 'vitest'
import type { Room, CreateRoomInput, UpdateRoomInput } from '@domain/entities/room.entity'
import type { CreatedRoom, IRoomRepository } from '@domain/repositories/room.repository'

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
    findByIds: vi.fn<(ids: readonly string[]) => Promise<Room[]>>().mockResolvedValue([]),
    findByHostId: vi.fn<(hostId: string) => Promise<Room[]>>().mockResolvedValue([]),
    findAll: vi.fn<() => Promise<Room[]>>().mockResolvedValue([]),
    findAvailable: vi.fn<(now: Date) => Promise<Room[]>>().mockResolvedValue([]),
    countActiveByHostId: vi
      .fn<(hostId: string, now: Date) => Promise<number>>()
      .mockResolvedValue(0),
    findMyRooms: vi
      .fn<(userId: string, now: Date) => Promise<{ hosted: Room[]; joined: Room[] }>>()
      .mockResolvedValue({ hosted: [], joined: [] }),
    create: vi
      .fn<(input: CreateRoomInput, now: Date) => Promise<CreatedRoom>>()
      .mockImplementation((input, now) =>
        Promise.resolve({
          room: createMockRoom({
            name: input.name,
            hostId: input.hostId,
            gameId: input.gameId,
            maxPlayers: input.maxPlayers ?? 5,
            discordLink: input.discordLink ?? null,
            tags: input.tags ?? [],
            language: (input.language ?? 'pt-br') as 'en' | 'pt-br',
            lastActivityAt: now,
            createdAt: now,
            updatedAt: now,
          }),
          hostMember: {
            id: 'room-member-uuid-1',
            roomId: 'room-uuid-1',
            userId: input.hostId,
            joinedAt: now,
          },
        })
      ),
    findExpiredRooms: vi.fn<(now: Date) => Promise<Room[]>>().mockResolvedValue([]),
    deleteExpired: vi.fn<(id: string, now: Date) => Promise<boolean>>().mockResolvedValue(false),
    update: vi
      .fn<(id: string, input: UpdateRoomInput, now: Date) => Promise<Room | null>>()
      .mockResolvedValue(null),
    delete: vi.fn<(id: string) => Promise<boolean>>().mockResolvedValue(false),
  }
}
