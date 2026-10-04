import { describe, it, expect, beforeEach } from 'vitest'
import { JoinRoomUseCase } from './join-room.use-case'
import {
  RoomNotFoundError,
  RoomFullError,
  RoomJoinLimitReachedError,
  RoomReadyError,
} from '@application/errors'
import type { JoinOpenRoomInput } from '@domain/repositories/room-member.repository'
import { ROOM } from '@config/constants'
import {
  createMockClock,
  createMockGame,
  createMockGameRepository,
  createMockRoom,
  createMockRoomMember,
  createMockRoomMemberRepository,
  createMockRoomRepository,
  createMockUser,
  FIXED_NOW,
} from '@test/mocks'

describe('JoinRoomUseCase', () => {
  let useCase: JoinRoomUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let mockRoomMemberRepository: ReturnType<typeof createMockRoomMemberRepository>
  let mockGameRepository: ReturnType<typeof createMockGameRepository>
  let clock: ReturnType<typeof createMockClock>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    mockRoomMemberRepository = createMockRoomMemberRepository()
    mockGameRepository = createMockGameRepository()
    clock = createMockClock()
    useCase = new JoinRoomUseCase(
      mockRoomRepository,
      mockRoomMemberRepository,
      mockGameRepository,
      clock
    )
  })

  function openRoom(overrides = {}) {
    return createMockRoom({
      id: 'room-1',
      code: 'ABC123',
      lastActivityAt: FIXED_NOW,
      createdAt: FIXED_NOW,
      ...overrides,
    })
  }

  describe('execute', () => {
    it('should join room successfully and return the authoritative member count', async () => {
      const room = openRoom({ maxPlayers: 5 })
      const expectedMember = createMockRoomMember({ roomId: 'room-1', userId: 'user-1' })

      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.joinOpenRoom.mockResolvedValue({
        status: 'joined',
        member: expectedMember,
        memberCount: 3,
        becameReady: false,
        notifications: [],
      })

      const result = await useCase.execute({ code: 'ABC123', userId: 'user-1' })

      expect(result.room).toEqual(room)
      expect(result.roomMember).toEqual(expectedMember)
      expect(result.memberCount).toBe(3)
      expect(result.isRoomNowFull).toBe(false)
      expect(result.createdNotifications).toEqual([])
      expect(mockRoomRepository.findByCode).toHaveBeenCalledWith('ABC123')
      expect(mockRoomMemberRepository.findByRoomAndUser).toHaveBeenCalledWith('room-1', 'user-1')
      expect(mockRoomMemberRepository.joinOpenRoom).toHaveBeenCalledWith({
        roomId: 'room-1',
        userId: 'user-1',
        buildReadyNotifications: expect.any(Function),
      })
    })

    it('should throw RoomNotFoundError if room not found', async () => {
      mockRoomRepository.findByCode.mockResolvedValue(null)

      await expect(useCase.execute({ code: 'ZZZZZZ', userId: 'user-1' })).rejects.toThrow(
        RoomNotFoundError
      )

      expect(mockRoomMemberRepository.joinOpenRoom).not.toHaveBeenCalled()
    })

    it('should throw RoomNotFoundError when the room is already past its activity window', async () => {
      const room = openRoom({
        lastActivityAt: new Date(FIXED_NOW.getTime() - ROOM.OPEN_ROOM_TTL_MS),
      })
      mockRoomRepository.findByCode.mockResolvedValue(room)

      await expect(useCase.execute({ code: 'ABC123', userId: 'user-1' })).rejects.toThrow(
        RoomNotFoundError
      )
      expect(mockRoomMemberRepository.joinOpenRoom).not.toHaveBeenCalled()
    })

    it('should throw RoomFullError if the transaction rejects the join as full', async () => {
      const room = openRoom({ maxPlayers: 5 })

      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.joinOpenRoom.mockResolvedValue({
        status: 'full',
        memberCount: 5,
      })

      await expect(useCase.execute({ code: 'ABC123', userId: 'user-1' })).rejects.toThrow(
        RoomFullError
      )
    })

    it('should throw RoomReadyError when the transaction finds a ready room with a free seat', async () => {
      const room = openRoom({ maxPlayers: 5 })

      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.joinOpenRoom.mockResolvedValue({ status: 'ready' })

      await expect(useCase.execute({ code: 'ABC123', userId: 'user-1' })).rejects.toThrow(
        RoomReadyError
      )
    })

    it('should throw RoomNotFoundError when the transaction finds the room expired', async () => {
      const room = openRoom({ maxPlayers: 5 })

      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.joinOpenRoom.mockResolvedValue({ status: 'expired' })

      await expect(useCase.execute({ code: 'ABC123', userId: 'user-1' })).rejects.toThrow(
        RoomNotFoundError
      )
    })

    it('should return existing member if user already in room (idempotent)', async () => {
      const room = openRoom({ maxPlayers: 5 })
      const existingMember = createMockRoomMember({ roomId: 'room-1', userId: 'user-1' })

      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(existingMember)
      mockRoomMemberRepository.countByRoomId.mockResolvedValue(3)

      const result = await useCase.execute({ code: 'ABC123', userId: 'user-1' })

      expect(result.roomMember).toEqual(existingMember)
      expect(result.memberCount).toBe(3)
      expect(result.isRoomNowFull).toBe(false)
      expect(mockRoomMemberRepository.joinOpenRoom).not.toHaveBeenCalled()
    })

    it('should surface readiness and the notifications persisted by the transaction', async () => {
      const room = openRoom({ maxPlayers: 3 })
      const expectedMember = createMockRoomMember({ roomId: 'room-1', userId: 'user-3' })

      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.joinOpenRoom.mockResolvedValue({
        status: 'joined',
        member: expectedMember,
        memberCount: 3,
        becameReady: true,
        notifications: [
          {
            id: 'notification-1',
            userId: 'user-3',
            roomId: 'room-1',
            type: 'room_ready',
            title: 'Room ready: your squad is full',
            message: 'ready',
            payload: {
              roomId: 'room-1',
              roomCode: 'ABC123',
              roomName: 'Test Room',
              gameName: 'Game',
              players: [],
            },
            readAt: null,
            createdAt: FIXED_NOW,
          },
        ],
      })

      const result = await useCase.execute({ code: 'ABC123', userId: 'user-3' })

      expect(result.isRoomNowFull).toBe(true)
      expect(result.createdNotifications).toHaveLength(1)
      expect(result.createdNotifications[0]).toMatchObject({
        userId: 'user-3',
        type: 'room_ready',
      })
    })

    it('should build one invite-free notification per authoritative member', async () => {
      const room = openRoom({ maxPlayers: 2, discordLink: 'https://discord.gg/x' })
      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockGameRepository.findById.mockResolvedValue(createMockGame({ name: 'League' }))
      const users = [
        createMockUser({ id: 'host', name: 'Host' }),
        createMockUser({ id: 'user-2', name: 'Joiner' }),
      ]

      let captured: JoinOpenRoomInput | undefined
      mockRoomMemberRepository.joinOpenRoom.mockImplementation(async (input) => {
        captured = input
        const members = [
          createMockRoomMember({ roomId: input.roomId, userId: 'host' }),
          createMockRoomMember({ roomId: input.roomId, userId: input.userId }),
        ]
        const notifications = input.buildReadyNotifications?.(members, users) ?? []
        return {
          status: 'joined',
          member: members[1]!,
          memberCount: 2,
          becameReady: true,
          notifications: notifications.map((notification, index) => ({
            ...notification,
            id: `notification-${index}`,
            readAt: null,
            createdAt: FIXED_NOW,
          })),
        }
      })

      const result = await useCase.execute({ code: 'ABC123', userId: 'user-2' })

      expect(captured?.buildReadyNotifications).toBeTypeOf('function')
      expect(result.createdNotifications).toHaveLength(2)
      for (const notification of result.createdNotifications) {
        expect(notification.type).toBe('room_ready')
        expect(notification.payload).not.toHaveProperty('discordLink')
      }
      expect(result.createdNotifications.map((n) => n.userId).sort()).toEqual(['host', 'user-2'])
      expect(result.createdNotifications[0]?.payload.players).toEqual([
        { name: 'Host', image: null },
        { name: 'Joiner', image: null },
      ])
      expect(result.createdNotifications[1]?.payload.players).toEqual(
        result.createdNotifications[0]?.payload.players
      )
    })

    it('should resolve the notification players from the members that committed inside the join', async () => {
      const room = openRoom({ maxPlayers: 3 })
      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockGameRepository.findById.mockResolvedValue(createMockGame({ name: 'League' }))

      mockRoomMemberRepository.joinOpenRoom.mockImplementation(async (input) => {
        // A member that committed after the use case started: only the member
        // list read inside the transaction knows about them.
        const members = [
          createMockRoomMember({ roomId: input.roomId, userId: 'host' }),
          createMockRoomMember({ roomId: input.roomId, userId: 'late-member' }),
          createMockRoomMember({ roomId: input.roomId, userId: input.userId }),
        ]
        const users = members.map((member) =>
          createMockUser({ id: member.userId, name: `Name-${member.userId}` })
        )
        const notifications = input.buildReadyNotifications?.(members, users) ?? []
        return {
          status: 'joined',
          member: members[2]!,
          memberCount: 3,
          becameReady: true,
          notifications: notifications.map((notification, index) => ({
            ...notification,
            id: `notification-${index}`,
            readAt: null,
            createdAt: FIXED_NOW,
          })),
        }
      })

      const result = await useCase.execute({ code: 'ABC123', userId: 'user-2' })

      expect(result.createdNotifications.map((notification) => notification.userId)).toEqual([
        'host',
        'late-member',
        'user-2',
      ])
      expect(result.createdNotifications[0]?.payload.players).toEqual([
        { name: 'Name-host', image: null },
        { name: 'Name-late-member', image: null },
        { name: 'Name-user-2', image: null },
      ])
      expect(JSON.stringify(result.createdNotifications)).not.toContain('Unknown')
    })

    it('should throw RoomJoinLimitReachedError when the transaction reports the limit', async () => {
      const room = openRoom({ maxPlayers: 5 })

      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.joinOpenRoom.mockResolvedValue({ status: 'limit_reached' })

      await expect(useCase.execute({ code: 'ABC123', userId: 'user-id' })).rejects.toThrow(
        RoomJoinLimitReachedError
      )

      expect(mockRoomMemberRepository.joinOpenRoom).toHaveBeenCalledOnce()
    })

    it('should allow joining when user is in 4 valid rooms (below limit)', async () => {
      const room = openRoom({ maxPlayers: 5 })
      const expectedMember = createMockRoomMember({ roomId: 'room-1', userId: 'user-id' })

      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.joinOpenRoom.mockResolvedValue({
        status: 'joined',
        member: expectedMember,
        memberCount: 3,
        becameReady: false,
        notifications: [],
      })

      const result = await useCase.execute({ code: 'ABC123', userId: 'user-id' })

      expect(mockRoomMemberRepository.joinOpenRoom).toHaveBeenCalledOnce()
      expect(result.roomMember).toBeDefined()
    })
  })
})
