import { describe, expect, it } from 'vitest'
import { isRoomExpired, roomExpiresAt } from './room-lifecycle'

const WINDOWS = { OPEN_ROOM_TTL_MS: 86_400_000, READY_ROOM_RETENTION_MS: 3_600_000 }
const LAST_ACTIVITY = new Date('2026-01-01T00:00:00.000Z')
const READY_AT = new Date('2026-01-01T12:00:00.000Z')

describe('roomExpiresAt', () => {
  it('anchors an Open Room on Room Activity plus 24h', () => {
    expect(
      roomExpiresAt({ readyAt: null, lastActivityAt: LAST_ACTIVITY }, WINDOWS).toISOString()
    ).toBe('2026-01-02T00:00:00.000Z')
  })

  it('anchors a Ready Room on readyAt plus 60min, ignoring Room Activity', () => {
    expect(
      roomExpiresAt({ readyAt: READY_AT, lastActivityAt: LAST_ACTIVITY }, WINDOWS).toISOString()
    ).toBe('2026-01-01T13:00:00.000Z')
  })
})

describe('isRoomExpired', () => {
  it('is false one millisecond before the Open Room expiration', () => {
    const now = new Date(LAST_ACTIVITY.getTime() + WINDOWS.OPEN_ROOM_TTL_MS - 1)

    expect(isRoomExpired({ readyAt: null, lastActivityAt: LAST_ACTIVITY }, now, WINDOWS)).toBe(
      false
    )
  })

  it('is true at exactly lastActivityAt + 24h', () => {
    const now = new Date(LAST_ACTIVITY.getTime() + WINDOWS.OPEN_ROOM_TTL_MS)

    expect(isRoomExpired({ readyAt: null, lastActivityAt: LAST_ACTIVITY }, now, WINDOWS)).toBe(true)
  })

  it('is false one millisecond before the Ready Room retention ends', () => {
    const now = new Date(READY_AT.getTime() + WINDOWS.READY_ROOM_RETENTION_MS - 1)

    expect(isRoomExpired({ readyAt: READY_AT, lastActivityAt: LAST_ACTIVITY }, now, WINDOWS)).toBe(
      false
    )
  })

  it('is true at exactly readyAt + 60min', () => {
    const now = new Date(READY_AT.getTime() + WINDOWS.READY_ROOM_RETENTION_MS)

    expect(isRoomExpired({ readyAt: READY_AT, lastActivityAt: LAST_ACTIVITY }, now, WINDOWS)).toBe(
      true
    )
  })
})
