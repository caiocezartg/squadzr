import { describe, expect, it } from 'vitest'
import type { UserNotificationRow } from '@infrastructure/database/schema/user-notifications'
import { mapUserNotificationRow } from './user-notification-mapping'

const ROOM_ID = '4b1f6a1e-6d1c-4f7e-9b8a-2f3c5d6e7a8b'
const PAYLOAD = {
  roomId: ROOM_ID,
  roomCode: 'ABC123',
  roomName: 'Ranked squad',
  gameName: 'League of Legends',
  players: [{ name: 'Ana', image: null }],
}

function createRow(payload: Record<string, unknown>): UserNotificationRow {
  return {
    id: '9d2c1b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
    userId: 'user-1',
    roomId: ROOM_ID,
    type: 'room_ready',
    title: 'Squad ready',
    message: 'Your squad is full.',
    payload,
    readAt: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  }
}

describe('mapUserNotificationRow', () => {
  it('maps the row to a notification carrying the public payload', () => {
    expect(mapUserNotificationRow(createRow(PAYLOAD))).toEqual({
      id: '9d2c1b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
      userId: 'user-1',
      roomId: ROOM_ID,
      type: 'room_ready',
      title: 'Squad ready',
      message: 'Your squad is full.',
      payload: PAYLOAD,
      readAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    })
  })

  it('strips a legacy discordLink so an old row cannot leak the invite', () => {
    const notification = mapUserNotificationRow(
      createRow({ ...PAYLOAD, discordLink: 'https://discord.gg/legacy' })
    )

    expect(notification.payload).toEqual(PAYLOAD)
    expect(notification.payload).not.toHaveProperty('discordLink')
  })
})
