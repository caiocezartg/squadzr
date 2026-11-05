import { describe, expect, it } from 'vitest'
import type { SquadDeparture } from '@domain/services/squad-release'
import { createMockUser } from '@test/mocks'
import { buildSquadReleaseNotifications } from './squad-release-notifications'

const users = [
  createMockUser({ id: 'old-host', name: 'Old Host', avatarUrl: 'https://cdn.test/old.png' }),
  createMockUser({ id: 'leaver', name: 'Leaver' }),
  createMockUser({ id: 'other-leaver', name: 'Other Leaver' }),
]

function departure(overrides: Partial<SquadDeparture>): SquadDeparture {
  return {
    roomId: 'room-b',
    roomCode: 'BBB222',
    roomName: 'Squad B',
    gameName: 'League of Legends',
    gameCoverUrl: 'https://images.igdb.com/lol.jpg',
    outcome: 'updated',
    removedUserIds: ['leaver'],
    remainingUserIds: ['host', 'stayer'],
    previousHostId: 'host',
    newHostId: null,
    ...overrides,
  }
}

const squadPayload = {
  roomId: 'room-b',
  roomCode: 'BBB222',
  roomName: 'Squad B',
  gameName: 'League of Legends',
  gameCoverUrl: 'https://images.igdb.com/lol.jpg',
}

describe('buildSquadReleaseNotifications', () => {
  it('tells the host a member left, once per leaver', () => {
    const notifications = buildSquadReleaseNotifications({
      users,
      departures: [departure({ removedUserIds: ['leaver', 'other-leaver'] })],
    })

    expect(notifications).toHaveLength(2)
    expect(notifications.map((n) => [n.userId, n.type])).toEqual([
      ['host', 'member_left'],
      ['host', 'member_left'],
    ])
    expect(notifications[0]).toMatchObject({
      roomId: 'room-b',
      payload: {
        ...squadPayload,
        member: { name: 'Leaver', image: null },
        reason: 'squad_completed',
      },
    })
    expect(notifications[1]?.payload).toMatchObject({ member: { name: 'Other Leaver' } })
  })

  it('tells the new host they inherited the Squad, and the new host about everyone else who left', () => {
    const notifications = buildSquadReleaseNotifications({
      users,
      departures: [
        departure({
          previousHostId: 'old-host',
          removedUserIds: ['old-host', 'leaver'],
          newHostId: 'heir',
        }),
      ],
    })

    expect(notifications.map((n) => [n.userId, n.type])).toEqual([
      ['heir', 'host_transferred'],
      ['heir', 'member_left'],
    ])
    expect(notifications[0]?.payload).toMatchObject({
      ...squadPayload,
      previousHost: { name: 'Old Host', image: 'https://cdn.test/old.png' },
      reason: 'squad_completed',
    })
    expect(notifications[1]?.payload).toMatchObject({ member: { name: 'Leaver' } })
  })

  it('never says the old host left as a member', () => {
    const notifications = buildSquadReleaseNotifications({
      users,
      departures: [
        departure({ previousHostId: 'old-host', removedUserIds: ['old-host'], newHostId: 'heir' }),
      ],
    })

    expect(notifications.map((n) => n.type)).toEqual(['host_transferred'])
  })

  it('tells every remaining member of a closed Squad, and nobody else', () => {
    const notifications = buildSquadReleaseNotifications({
      users,
      departures: [
        departure({
          outcome: 'closed',
          previousHostId: 'old-host',
          removedUserIds: ['old-host'],
          remainingUserIds: ['busy-1', 'busy-2'],
        }),
      ],
    })

    expect(notifications.map((n) => [n.userId, n.type])).toEqual([
      ['busy-1', 'room_closed'],
      ['busy-2', 'room_closed'],
    ])
    expect(notifications[0]?.payload).toMatchObject({
      ...squadPayload,
      previousHost: { name: 'Old Host', image: 'https://cdn.test/old.png' },
      reason: 'no_eligible_host',
    })
  })

  it('tells nobody about a Squad that was deleted for being left empty', () => {
    const notifications = buildSquadReleaseNotifications({
      users,
      departures: [departure({ outcome: 'deleted', remainingUserIds: [] })],
    })

    expect(notifications).toEqual([])
  })

  it('omits the cover when the Squad Game has none and falls back to Unknown for a missing profile', () => {
    const { gameCoverUrl: _cover, ...withoutCover } = departure({ removedUserIds: ['ghost'] })

    const [notification] = buildSquadReleaseNotifications({
      users,
      departures: [withoutCover],
    })

    expect(notification?.payload).not.toHaveProperty('gameCoverUrl')
    expect(notification?.payload).toMatchObject({ member: { name: 'Unknown', image: null } })
  })

  it('never stores a Discord invite', () => {
    const notifications = buildSquadReleaseNotifications({
      users,
      departures: [
        departure({ previousHostId: 'old-host', removedUserIds: ['old-host'], newHostId: 'heir' }),
        departure({ outcome: 'closed', remainingUserIds: ['busy'] }),
        departure({}),
      ],
    })

    expect(notifications.length).toBeGreaterThan(0)
    for (const notification of notifications) {
      expect(notification.payload).not.toHaveProperty('discordLink')
    }
  })
})
