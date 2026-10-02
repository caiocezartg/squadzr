import { describe, expect, it } from 'vitest'
import { publicRoomSchema, roomMemberSchema, roomSchema } from '@squadzr/schemas'
import { createMockRoom, createMockRoomMember } from '@test/mocks'
import { toMemberRoom, toPublicRoom, toRoomMemberDto } from './room.projection'

const ROOM_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const GAME_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const INVITE = 'https://discord.gg/squadzr'

const readyRoom = createMockRoom({
  id: ROOM_ID,
  gameId: GAME_ID,
  discordLink: INVITE,
  completedAt: new Date('2024-01-02T10:00:00.000Z'),
  readyNotifiedAt: new Date('2024-01-02T10:00:01.000Z'),
  createdAt: new Date('2024-01-01T08:30:00.000Z'),
  updatedAt: new Date('2024-01-01T09:45:00.000Z'),
})

describe('toPublicRoom', () => {
  it('keeps the catalog fields and serializes dates as ISO strings', () => {
    expect(toPublicRoom(readyRoom)).toEqual({
      id: ROOM_ID,
      code: 'ABC123',
      name: 'Test Room',
      hostId: 'user-uuid-1',
      gameId: GAME_ID,
      status: 'waiting',
      maxPlayers: 5,
      tags: [],
      language: 'pt-br',
      createdAt: '2024-01-01T08:30:00.000Z',
      updatedAt: '2024-01-01T09:45:00.000Z',
    })
  })

  it('never carries the Discord invite or the internal lifecycle timestamps', () => {
    const projection = toPublicRoom(readyRoom)

    expect(JSON.stringify(projection)).not.toContain(INVITE)
    expect(projection).not.toHaveProperty('discordLink')
    expect(projection).not.toHaveProperty('completedAt')
    expect(projection).not.toHaveProperty('readyNotifiedAt')
  })

  it('includes memberCount and isMember only when the room carries them', () => {
    expect(toPublicRoom(readyRoom)).not.toHaveProperty('memberCount')
    expect(toPublicRoom(readyRoom)).not.toHaveProperty('isMember')
    expect(toPublicRoom({ ...readyRoom, memberCount: 3, isMember: false })).toMatchObject({
      memberCount: 3,
      isMember: false,
    })
  })

  it('satisfies the shared public room contract', () => {
    const projection = toPublicRoom(readyRoom)

    expect(publicRoomSchema.parse(projection)).toEqual(projection)
  })
})

describe('toMemberRoom', () => {
  it('adds the Discord invite to the public projection', () => {
    const projection = toMemberRoom(readyRoom)

    expect(projection).toEqual({ ...toPublicRoom(readyRoom), discordLink: INVITE })
    expect(roomSchema.parse(projection)).toEqual(projection)
  })
})

describe('toRoomMemberDto', () => {
  it('serializes joinedAt as an ISO string', () => {
    const member = createMockRoomMember({
      id: '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6b',
      roomId: ROOM_ID,
      joinedAt: new Date('2024-01-01T08:31:00.000Z'),
    })

    const dto = toRoomMemberDto(member)

    expect(dto.joinedAt).toBe('2024-01-01T08:31:00.000Z')
    expect(roomMemberSchema.parse(dto)).toEqual(dto)
  })
})
