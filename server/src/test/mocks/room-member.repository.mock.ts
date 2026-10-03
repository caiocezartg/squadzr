import { vi, type Mock } from 'vitest'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type {
  IRoomMemberRepository,
  JoinOpenRoomInput,
  JoinOpenRoomOutcome,
  LeaveOpenRoomInput,
  LeaveOpenRoomOutcome,
} from '@domain/repositories/room-member.repository'

export function createMockRoomMember(overrides?: Partial<RoomMember>): RoomMember {
  return {
    id: 'room-member-uuid-1',
    roomId: 'room-uuid-1',
    userId: 'user-uuid-1',
    joinedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export type MockRoomMemberRepository = {
  [K in keyof IRoomMemberRepository]: Mock<IRoomMemberRepository[K]>
}

export function createMockRoomMemberRepository(): MockRoomMemberRepository {
  return {
    findByRoomId: vi.fn<(roomId: string) => Promise<RoomMember[]>>().mockResolvedValue([]),
    findByUserId: vi.fn<(userId: string) => Promise<RoomMember[]>>().mockResolvedValue([]),
    findByRoomAndUser: vi
      .fn<(roomId: string, userId: string) => Promise<RoomMember | null>>()
      .mockResolvedValue(null),
    countByRoomId: vi.fn<(roomId: string) => Promise<number>>().mockResolvedValue(0),
    countActiveByUserId: vi
      .fn<(userId: string, now: Date) => Promise<number>>()
      .mockResolvedValue(0),
    joinOpenRoom: vi
      .fn<(input: JoinOpenRoomInput) => Promise<JoinOpenRoomOutcome>>()
      .mockImplementation((input) =>
        Promise.resolve({
          status: 'joined',
          member: createMockRoomMember({ roomId: input.roomId, userId: input.userId }),
          memberCount: 1,
          becameReady: false,
          notifications: [],
        })
      ),
    leaveOpenRoom: vi
      .fn<(input: LeaveOpenRoomInput) => Promise<LeaveOpenRoomOutcome>>()
      .mockResolvedValue({ status: 'not_member' }),
  }
}
