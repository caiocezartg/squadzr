import { describe, expect, it } from 'vitest'
import { GetRealtimeSnapshotUseCase } from './get-realtime-snapshot.use-case'
import {
  createMockRoom,
  createMockRoomMember,
  createMockRoomRepository,
  createMockRoomMemberRepository,
  createMockUser,
  createMockUserRepository,
} from '@test/mocks'
import { FakeClock } from '@test/harness/clock'
import { ROOM } from '@config/constants'

const NOW = new Date('2026-01-01T00:00:00Z')

function setup() {
  const clock = new FakeClock(NOW)
  const rooms = createMockRoomRepository()
  const members = createMockRoomMemberRepository()
  const users = createMockUserRepository()
  const room = createMockRoom({ createdAt: NOW, lastActivityAt: NOW })
  const member = createMockRoomMember({ roomId: room.id, userId: room.hostId })
  rooms.findByCode.mockResolvedValue(room)
  members.findByRoomAndUser.mockResolvedValue(member)
  members.findByRoomId.mockResolvedValue([member])
  users.findByIds.mockResolvedValue([createMockUser({ id: room.hostId })])
  return {
    clock,
    rooms,
    members,
    users,
    room,
    useCase: new GetRealtimeSnapshotUseCase(rooms, members, users, clock),
  }
}

describe('realtime snapshot read', () => {
  it('answers null for a Ready Room at its exact retention deadline', async () => {
    const { useCase, rooms, room, clock } = setup()
    rooms.findByCode.mockResolvedValue({ ...room, readyAt: NOW })
    clock.advance(60 * 60_000)
    expect(await useCase.execute({ code: 'ABC123' })).toBeNull()
  })

  it('reads the durable roster for post-commit publications and ignores deleted rooms', async () => {
    const { useCase, room, rooms, members, users } = setup()
    members.findByRoomId.mockResolvedValue([
      createMockRoomMember({ roomId: room.id, userId: room.hostId }),
      createMockRoomMember({ roomId: room.id, userId: 'member' }),
      createMockRoomMember({ roomId: room.id, userId: 'missing-user' }),
    ])
    users.findByIds.mockResolvedValue([
      createMockUser({ id: 'member', name: 'Member', avatarUrl: 'https://cdn.test/member.png' }),
      createMockUser({ id: room.hostId, name: 'Host' }),
    ])
    expect(await useCase.execute({ code: 'ABC123' })).toMatchObject({
      room,
      players: [
        { id: room.hostId, name: 'Host', image: null, isHost: true },
        { id: 'member', name: 'Member', image: 'https://cdn.test/member.png', isHost: false },
      ],
    })
    expect(rooms.findByCode).toHaveBeenCalledTimes(1)
    expect(members.findByRoomAndUser).not.toHaveBeenCalled()
    rooms.findByCode.mockResolvedValue(null)
    expect(await useCase.execute({ code: 'ABC123' })).toBeNull()
  })

  it.each([
    { state: 'Open', readyAt: null },
    { state: 'Ready', readyAt: NOW },
  ])('reads a $state Room roster without using host Membership as access', async ({ readyAt }) => {
    const { useCase, room, rooms, members, users } = setup()
    const publicationRoom = { ...room, readyAt }
    rooms.findByCode.mockResolvedValue(publicationRoom)
    members.findByRoomAndUser.mockResolvedValue(null)
    members.findByRoomId.mockResolvedValue([
      createMockRoomMember({ roomId: room.id, userId: 'member' }),
    ])
    users.findByIds.mockResolvedValue([createMockUser({ id: 'member', name: 'Member' })])

    expect(await useCase.execute({ code: 'ABC123' })).toEqual({
      room: publicationRoom,
      players: [{ id: 'member', name: 'Member', image: null, isHost: false }],
      expiresAt: new Date(
        NOW.getTime() + (readyAt ? ROOM.READY_ROOM_RETENTION_MS : ROOM.OPEN_ROOM_TTL_MS)
      ),
    })
    expect(members.findByRoomAndUser).not.toHaveBeenCalled()
  })

  it.each([
    { state: 'Open', readyAt: null, retention: ROOM.OPEN_ROOM_TTL_MS },
    { state: 'Ready', readyAt: NOW, retention: ROOM.READY_ROOM_RETENTION_MS },
  ])(
    'stops reading a $state Room roster at its exact expiration',
    async ({ readyAt, retention }) => {
      const { useCase, room, rooms, members, users, clock } = setup()
      rooms.findByCode.mockResolvedValue({ ...room, readyAt })
      clock.advance(retention - 1)
      expect(await useCase.execute({ code: 'ABC123' })).not.toBeNull()
      members.findByRoomId.mockClear()
      users.findByIds.mockClear()

      clock.advance(1)
      expect(await useCase.execute({ code: 'ABC123' })).toBeNull()
      expect(members.findByRoomId).not.toHaveBeenCalled()
      expect(users.findByIds).not.toHaveBeenCalled()
    }
  )
})
