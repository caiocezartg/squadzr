import { describe, expect, it } from 'vitest'
import { findUnexpiredRoomByCode } from './find-unexpired-room-by-code'
import { createMockClock, createMockRoom, createMockRoomRepository } from '@test/mocks'
import { ROOM } from '@config/constants'

const ACTIVITY = new Date('2026-01-01T00:00:00.000Z')
const READY_AT = new Date('2026-01-01T12:00:00.000Z')

describe('findUnexpiredRoomByCode', () => {
  it('returns the Squad by its code while it is not expired', async () => {
    const rooms = createMockRoomRepository()
    const room = createMockRoom({ code: 'ABC123', lastActivityAt: ACTIVITY })
    rooms.findByCode.mockResolvedValue(room)

    const found = await findUnexpiredRoomByCode(rooms, createMockClock(ACTIVITY), 'ABC123')

    expect(found).toEqual(room)
    expect(rooms.findByCode).toHaveBeenCalledWith('ABC123')
  })

  it('treats a missing Squad as absent', async () => {
    const rooms = createMockRoomRepository()

    expect(await findUnexpiredRoomByCode(rooms, createMockClock(), 'NOTFND')).toBeNull()
  })

  it.each([
    {
      state: 'Open',
      room: { lastActivityAt: ACTIVITY, readyAt: null },
      expiresAt: new Date(ACTIVITY.getTime() + ROOM.OPEN_ROOM_TTL_MS),
    },
    {
      state: 'Ready',
      room: { lastActivityAt: ACTIVITY, readyAt: READY_AT },
      expiresAt: new Date(READY_AT.getTime() + ROOM.READY_ROOM_RETENTION_MS),
    },
  ])('treats a $state Squad as absent from its exact expiration', async ({ room, expiresAt }) => {
    const rooms = createMockRoomRepository()
    rooms.findByCode.mockResolvedValue(createMockRoom(room))

    const beforeExpiry = createMockClock(new Date(expiresAt.getTime() - 1))
    expect(await findUnexpiredRoomByCode(rooms, beforeExpiry, 'ABC123')).not.toBeNull()

    const atExpiry = createMockClock(expiresAt)
    expect(await findUnexpiredRoomByCode(rooms, atExpiry, 'ABC123')).toBeNull()
  })
})
