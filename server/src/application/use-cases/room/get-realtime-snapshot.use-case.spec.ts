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
    const { useCase, members, users } = setup()
    members.findByRoomAndUser.mockResolvedValue(null)
    await expect(useCase.subscribe('ABC123', 'outsider')).rejects.toMatchObject({
      code: 'NOT_ROOM_MEMBER',
    })
    expect(users.findByIds).not.toHaveBeenCalled()
  })

  it('hides a Ready Room from non-members as ROOM_NOT_FOUND', async () => {
    const { useCase, rooms, members, room, users } = setup()
    rooms.findByCode.mockResolvedValue({ ...room, readyAt: NOW })
    members.findByRoomAndUser.mockResolvedValue(null)
    await expect(useCase.subscribe('ABC123', 'outsider')).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    })
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
    const { useCase, room, rooms } = setup()
    expect(await useCase.read('ABC123')).toMatchObject({
      room,
      players: [expect.objectContaining({ id: room.hostId })],
    })
    rooms.findByCode.mockResolvedValue(null)
    expect(await useCase.read('ABC123')).toBeNull()
  })
})
