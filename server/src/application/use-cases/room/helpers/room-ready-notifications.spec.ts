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

  it('carries the game cover next to the game name', () => {
    const notifications = buildRoomReadyNotifications({
      room,
      members: [createMockRoomMember({ roomId: 'room-1', userId: 'host' })],
      users: [createMockUser({ id: 'host', name: 'Host' })],
      gameName: 'League of Legends',
      gameCoverUrl: 'https://images.igdb.com/lol.jpg',
    })

    expect(notifications[0]?.payload).toMatchObject({
      gameName: 'League of Legends',
      gameCoverUrl: 'https://images.igdb.com/lol.jpg',
    })
  })

  it('omits the cover when the room game could not be resolved', () => {
    const notifications = buildRoomReadyNotifications({
      room,
      members: [createMockRoomMember({ roomId: 'room-1', userId: 'host' })],
      users: [createMockUser({ id: 'host', name: 'Host' })],
      gameName: 'Unknown game',
    })

    expect(notifications[0]?.payload).not.toHaveProperty('gameCoverUrl')
  })

  describe('squads left by the Squad Release', () => {
    const members = [
      createMockRoomMember({ roomId: 'room-1', userId: 'host' }),
      createMockRoomMember({ roomId: 'room-1', userId: 'member' }),
    ]
    const users = [
      createMockUser({ id: 'host', name: 'Host' }),
      createMockUser({ id: 'member', name: 'Member' }),
    ]
    const departure = (
      roomCode: string,
      roomName: string,
      removedUserIds: string[],
      outcome: 'updated' | 'deleted' = 'updated'
    ) => ({
      roomId: `id-${roomCode}`,
      roomCode,
      roomName,
      gameName: 'Dota 2',
      outcome,
      removedUserIds,
      remainingUserIds: [],
      previousHostId: 'someone',
      newHostId: null,
    })

    it('lists, for each member, every other squad they left and only those', () => {
      const notifications = buildRoomReadyNotifications({
        room,
        members,
        users,
        gameName: 'League of Legends',
        departures: [
          departure('AAA111', 'Squad A', ['member']),
          departure('BBB222', 'Squad B', ['host', 'member']),
          departure('CCC333', 'Squad C', ['host']),
        ],
      })

      expect(notifications[0]?.payload.leftSquads).toEqual([
        { roomCode: 'BBB222', roomName: 'Squad B' },
        { roomCode: 'CCC333', roomName: 'Squad C' },
      ])
      expect(notifications[1]?.payload.leftSquads).toEqual([
        { roomCode: 'AAA111', roomName: 'Squad A' },
        { roomCode: 'BBB222', roomName: 'Squad B' },
      ])
    })

    it('includes a squad the release deleted', () => {
      const [notification] = buildRoomReadyNotifications({
        room,
        members,
        users,
        gameName: 'League of Legends',
        departures: [departure('AAA111', 'Squad A', ['host'], 'deleted')],
      })

      expect(notification?.payload.leftSquads).toEqual([
        { roomCode: 'AAA111', roomName: 'Squad A' },
      ])
    })

    it('omits the field for a member who left nothing', () => {
      const notifications = buildRoomReadyNotifications({
        room,
        members,
        users,
        gameName: 'League of Legends',
        departures: [departure('AAA111', 'Squad A', ['member'])],
      })

      expect(notifications[0]?.payload).not.toHaveProperty('leftSquads')
    })
  })
})
