import { vi, type Mock } from 'vitest'
import type { Room, CreateRoomInput } from '@domain/entities/room.entity'
import type { CreateRoomOutcome, IRoomRepository } from '@domain/repositories/room.repository'
import { FIXED_NOW } from './clock.mock'

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
    findByCode: vi.fn<(code: string) => Promise<Room | null>>().mockResolvedValue(null),
    findByIds: vi.fn<(ids: readonly string[]) => Promise<Room[]>>().mockResolvedValue([]),
    findAvailable: vi.fn<(now: Date) => Promise<Room[]>>().mockResolvedValue([]),
    findMyRooms: vi
      .fn<(userId: string, now: Date) => Promise<{ hosted: Room[]; joined: Room[] }>>()
      .mockResolvedValue({ hosted: [], joined: [] }),
    create: vi
      .fn<(input: CreateRoomInput) => Promise<CreateRoomOutcome>>()
      .mockImplementation((input) =>
        Promise.resolve({
          status: 'created',
          room: createMockRoom({
            name: input.name,
            hostId: input.hostId,
            gameId: input.gameId,
            maxPlayers: input.maxPlayers ?? 5,
            discordLink: input.discordLink ?? null,
            tags: input.tags ?? [],
            language: (input.language ?? 'pt-br') as 'en' | 'pt-br',
            lastActivityAt: FIXED_NOW,
            createdAt: FIXED_NOW,
            updatedAt: FIXED_NOW,
          }),
          hostMember: {
            id: 'room-member-uuid-1',
            roomId: 'room-uuid-1',
            userId: input.hostId,
            joinedAt: FIXED_NOW,
          },
        })
      ),
    findExpiredRooms: vi.fn<(now: Date) => Promise<Room[]>>().mockResolvedValue([]),
    deleteExpired: vi.fn<(id: string, now: Date) => Promise<boolean>>().mockResolvedValue(false),
  }
}
