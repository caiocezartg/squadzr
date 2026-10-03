import { describe, expect, it } from 'vitest'
import { buildRoomReadyNotifications } from './room-ready-notifications'
import { createMockRoom, createMockRoomMember, createMockUser } from '@test/mocks'

const room = createMockRoom({
  id: 'room-1',
  code: 'ABC123',
  name: 'Ranked squad',
  discordLink: 'https://discord.gg/secret',
})

describe('buildRoomReadyNotifications', () => {
  it('creates one notification per authoritative member, with the squad roster', () => {
    const members = [
      createMockRoomMember({ roomId: 'room-1', userId: 'host' }),
      createMockRoomMember({ roomId: 'room-1', userId: 'member' }),
    ]
    const users = [
      createMockUser({ id: 'host', name: 'Host' }),
      createMockUser({ id: 'member', name: 'Member', avatarUrl: 'https://cdn.test/m.png' }),
    ]

    const notifications = buildRoomReadyNotifications({
      room,
      members,
      users,
      gameName: 'League of Legends',
    })

    expect(notifications).toHaveLength(2)
    expect(notifications.map((n) => n.userId)).toEqual(['host', 'member'])
    for (const notification of notifications) {
      expect(notification).toMatchObject({
        roomId: 'room-1',
        type: 'room_ready',
        title: 'Room ready: your squad is full',
        message: 'Ranked squad is ready. Your Discord invite is now available.',
        payload: {
          roomId: 'room-1',
          roomCode: 'ABC123',
          roomName: 'Ranked squad',
          gameName: 'League of Legends',
          players: [
            { name: 'Host', image: null },
            { name: 'Member', image: 'https://cdn.test/m.png' },
          ],
        },
      })
    }
  })

  it('never stores the Discord invite in the persisted payload', () => {
    const notifications = buildRoomReadyNotifications({
      room,
      members: [createMockRoomMember({ roomId: 'room-1', userId: 'host' })],
      users: [createMockUser({ id: 'host', name: 'Host' })],
      gameName: 'League of Legends',
    })

    expect(notifications[0]?.payload).not.toHaveProperty('discordLink')
    expect(JSON.stringify(notifications)).not.toContain('discord.gg/secret')
  })

  it('falls back to Unknown when a member user cannot be resolved', () => {
    const notifications = buildRoomReadyNotifications({
      room,
      members: [createMockRoomMember({ roomId: 'room-1', userId: 'ghost' })],
      users: [],
      gameName: 'League of Legends',
    })

    expect(notifications[0]?.payload.players).toEqual([{ name: 'Unknown', image: null }])
  })
})
