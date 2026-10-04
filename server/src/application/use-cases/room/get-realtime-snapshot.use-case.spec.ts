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
import { NotRoomMemberError, RoomNotFoundError } from '@application/errors'
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

describe('realtime snapshot access', () => {
  it('rejects guests before resolving any private data', async () => {
    const { useCase, rooms, users } = setup()
    await expect(useCase.subscribe('ABC123', null)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(rooms.findByCode).not.toHaveBeenCalled()
    expect(users.findByIds).not.toHaveBeenCalled()
  })

  it('rejects Open Room non-members without resolving the roster', async () => {
    const { useCase, members, users, room } = setup()
    members.findByRoomAndUser.mockResolvedValue(null)
    const subscription = useCase.subscribe('ABC123', 'outsider')
    await expect(subscription).rejects.toBeInstanceOf(NotRoomMemberError)
    await expect(subscription).rejects.toMatchObject({
      code: 'NOT_ROOM_MEMBER',
      statusCode: 422,
      message: `User "outsider" is not a member of room "${room.id}"`,
    })
    expect(members.findByRoomId).not.toHaveBeenCalled()
    expect(users.findByIds).not.toHaveBeenCalled()
  })

  it('hides a Ready Room from non-members as ROOM_NOT_FOUND', async () => {
    const { useCase, rooms, members, room, users } = setup()
    rooms.findByCode.mockResolvedValue({ ...room, readyAt: NOW })
    members.findByRoomAndUser.mockResolvedValue(null)
    const subscription = useCase.subscribe('ABC123', 'outsider')
    await expect(subscription).rejects.toBeInstanceOf(RoomNotFoundError)
    await expect(subscription).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    })
    expect(members.findByRoomId).not.toHaveBeenCalled()
    expect(users.findByIds).not.toHaveBeenCalled()
  })

  it('allows members until the exact Ready Room retention deadline', async () => {
    const { useCase, rooms, room, clock } = setup()
    rooms.findByCode.mockResolvedValue({ ...room, readyAt: NOW })
    clock.advance(60 * 60_000 - 1)
    expect(await useCase.subscribe('ABC123', room.hostId)).toMatchObject({
      userId: room.hostId,
      expiresAt: new Date(NOW.getTime() + 60 * 60_000),
      players: [expect.objectContaining({ id: room.hostId, isHost: true })],
    })
    clock.advance(1)
    await expect(useCase.subscribe('ABC123', room.hostId)).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    })
    expect(await useCase.read('ABC123')).toBeNull()
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
    expect(await useCase.read('ABC123')).toMatchObject({
      room,
      players: [
        { id: room.hostId, name: 'Host', image: null, isHost: true },
        { id: 'member', name: 'Member', image: 'https://cdn.test/member.png', isHost: false },
      ],
    })
    expect(rooms.findByCode).toHaveBeenCalledTimes(1)
    expect(members.findByRoomAndUser).not.toHaveBeenCalled()
    rooms.findByCode.mockResolvedValue(null)
    expect(await useCase.read('ABC123')).toBeNull()
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

    expect(await useCase.read('ABC123')).toEqual({
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
      expect(await useCase.read('ABC123')).not.toBeNull()
      members.findByRoomId.mockClear()
      users.findByIds.mockClear()

      clock.advance(1)
      expect(await useCase.read('ABC123')).toBeNull()
      expect(members.findByRoomId).not.toHaveBeenCalled()
      expect(users.findByIds).not.toHaveBeenCalled()
    }
  )
})
