import { describe, expect, it } from 'vitest'
import type { ClosedSquad } from '@domain/entities/admin-squad.entity'
import {
  buildAdminClosureAuditEntry,
  buildAdminClosureNotifications,
} from './admin-closure-records'

const squad: ClosedSquad = {
  roomId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  roomCode: 'VLR7K2',
  roomName: 'Ranked 5x5',
  gameName: 'Valorant',
  gameCoverUrl: 'https://cdn.example/cover.jpg',
  memberIds: ['host-1', 'member-2', 'member-3'],
}
const actor = { id: 'admin-1', name: 'Ana' }

describe('buildAdminClosureNotifications', () => {
  it('writes one room_closed_by_admin per member, the host included, with the reason', () => {
    const notifications = buildAdminClosureNotifications(squad, 'Offensive name')

    expect(notifications.map((notification) => notification.userId)).toEqual(squad.memberIds)
    for (const notification of notifications) {
      expect(notification).toMatchObject({
        roomId: squad.roomId,
        type: 'room_closed_by_admin',
        payload: {
          roomId: squad.roomId,
          roomCode: 'VLR7K2',
          roomName: 'Ranked 5x5',
          gameName: 'Valorant',
          gameCoverUrl: 'https://cdn.example/cover.jpg',
          reason: 'Offensive name',
        },
      })
    }
  })

  it('never names the admin', () => {
    const text = JSON.stringify(buildAdminClosureNotifications(squad, 'Offensive name'))

    expect(text).not.toContain(actor.name)
    expect(text).not.toContain(actor.id)
  })

  it('leaves the cover out for a Game without one', () => {
    const { gameCoverUrl: _cover, ...bare } = squad

    const [notification] = buildAdminClosureNotifications(bare, 'Spam')

    expect(notification?.payload).not.toHaveProperty('gameCoverUrl')
  })
})

describe('buildAdminClosureAuditEntry', () => {
  it('records the actor, the reason and a snapshot of the Squad', () => {
    const closedAt = new Date('2026-11-05T12:00:00.000Z')

    expect(buildAdminClosureAuditEntry(actor, 'Offensive name')(squad, closedAt)).toEqual({
      actorId: 'admin-1',
      actorName: 'Ana',
      action: 'squad_closed',
      target: {
        type: 'squad',
        id: squad.roomId,
        name: 'Ranked 5x5',
        code: 'VLR7K2',
        game: 'Valorant',
      },
      reason: 'Offensive name',
      details: null,
      createdAt: closedAt,
    })
  })
})
