import { describe, expect, it } from 'vitest'
import { userNotificationSchema } from '@squadzr/schemas'
import type { UserNotification } from '@domain/entities/user-notification.entity'
import { toUserNotificationDto } from './notification.projection'

const ROOM_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const INVITE = 'https://discord.gg/squadzr'

const base = {
  id: '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6b',
  userId: 'user-1',
  roomId: ROOM_ID,
  title: 'Title',
  message: 'Message',
  readAt: null,
  createdAt: new Date('2026-09-27T12:30:00.000Z'),
}
const squad = { roomId: ROOM_ID, roomCode: 'ABC123', roomName: 'Ranked', gameName: 'Dota 2' }
const person = { name: 'Caio', image: null }

const notifications: UserNotification[] = [
  {
    ...base,
    type: 'room_ready',
    payload: {
      ...squad,
      players: [person],
      leftSquads: [{ roomCode: 'DEF456', roomName: 'Other' }],
    },
  },
  {
    ...base,
    type: 'host_transferred',
    payload: { ...squad, previousHost: person, reason: 'squad_completed' },
  },
  {
    ...base,
    type: 'member_left',
    payload: { ...squad, member: person, reason: 'squad_completed' },
  },
  {
    ...base,
    type: 'room_closed',
    payload: { ...squad, previousHost: person, reason: 'no_eligible_host' },
  },
]

describe('toUserNotificationDto', () => {
  it.each(notifications)('projects a $type notification into the contract', (notification) => {
    const dto = toUserNotificationDto(notification, INVITE)

    expect(userNotificationSchema.parse(dto)).toEqual(dto)
    expect(dto.type).toBe(notification.type)
    expect(dto.createdAt).toBe('2026-09-27T12:30:00.000Z')
    expect(dto.readAt).toBeNull()
  })

  it('carries the resolved invite on room_ready only', () => {
    const dtos = notifications.map((notification) => toUserNotificationDto(notification, INVITE))

    expect(dtos[0]?.payload).toHaveProperty('discordLink', INVITE)
    for (const dto of dtos.slice(1)) expect(dto.payload).not.toHaveProperty('discordLink')
    expect(JSON.stringify(dtos.slice(1))).not.toContain(INVITE)
  })

  it('keeps leftSquads of a room_ready that has them, and leaves it out of one that does not', () => {
    const [withLeft] = notifications
    if (withLeft?.type !== 'room_ready') throw new Error('fixture')
    const { leftSquads: _left, ...legacyPayload } = withLeft.payload

    expect(toUserNotificationDto(withLeft, null).payload).toHaveProperty('leftSquads', [
      { roomCode: 'DEF456', roomName: 'Other' },
    ])
    expect(
      toUserNotificationDto({ ...withLeft, payload: legacyPayload }, null).payload
    ).not.toHaveProperty('leftSquads')
  })

  it('serializes readAt as an ISO instant', () => {
    const [notification] = notifications
    const readAt = new Date('2026-09-27T13:00:00.000Z')

    expect(toUserNotificationDto({ ...notification!, readAt }, null).readAt).toBe(
      '2026-09-27T13:00:00.000Z'
    )
  })
})
