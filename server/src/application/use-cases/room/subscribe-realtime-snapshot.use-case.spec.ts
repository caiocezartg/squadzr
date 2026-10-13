import { describe, expect, it } from 'vitest'
import { SubscribeRealtimeSnapshotUseCase } from './subscribe-realtime-snapshot.use-case'
import { GetRoomByCodeUseCase } from './get-room-by-code.use-case'
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
    useCase: new SubscribeRealtimeSnapshotUseCase(
      new GetRoomByCodeUseCase(rooms, members, users, clock)
    ),
  }
}

describe('realtime snapshot access', () => {
  it('rejects guests before resolving any private data', async () => {
    const { useCase, rooms, users } = setup()
    await expect(useCase.execute({ code: 'ABC123', userId: null })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect(rooms.findByCode).not.toHaveBeenCalled()
    expect(users.findByIds).not.toHaveBeenCalled()
  })

  it('rejects Open Room non-members without resolving the roster', async () => {
    const { useCase, members, users, room } = setup()
    members.findByRoomAndUser.mockResolvedValue(null)
    const subscription = useCase.execute({ code: 'ABC123', userId: 'outsider' })
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
    const subscription = useCase.execute({ code: 'ABC123', userId: 'outsider' })
    await expect(subscription).rejects.toBeInstanceOf(RoomNotFoundError)
    await expect(subscription).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    })
    expect(members.findByRoomId).not.toHaveBeenCalled()
    expect(users.findByIds).not.toHaveBeenCalled()
  })

  it('answers ROOM_NOT_FOUND for a room that does not exist', async () => {
    const { useCase, rooms } = setup()
    rooms.findByCode.mockResolvedValue(null)
    const subscription = useCase.execute({ code: 'ABC123', userId: 'outsider' })
    await expect(subscription).rejects.toBeInstanceOf(RoomNotFoundError)
    await expect(subscription).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
      message: 'Room "ABC123" not found',
    })
  })

  it('allows members until the exact Ready Room retention deadline', async () => {
    const { useCase, rooms, room, clock } = setup()
    rooms.findByCode.mockResolvedValue({ ...room, readyAt: NOW })
    clock.advance(60 * 60_000 - 1)
    expect(await useCase.execute({ code: 'ABC123', userId: room.hostId })).toMatchObject({
      userId: room.hostId,
      expiresAt: new Date(NOW.getTime() + 60 * 60_000),
      players: [expect.objectContaining({ id: room.hostId, isHost: true })],
    })
    clock.advance(1)
    await expect(useCase.execute({ code: 'ABC123', userId: room.hostId })).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    })
  })
})
