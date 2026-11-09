import { describe, expect, it } from 'vitest'
import {
  ADMIN_CLOSURE_REASON_MAX,
  ADMIN_CLOSURE_REASON_MIN,
  ADMIN_SQUAD_SORTS,
  PAGE_SIZE,
  adminSquadDetailResponseSchema,
  adminSquadSchema,
  adminSquadsQuerySchema,
  adminSquadsResponseSchema,
  closeSquadInputSchema,
  userNotificationPayloadSchema,
  userNotificationSchema,
} from './index'

const ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const GAME_ID = '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6b'
const AT = '2026-11-05T12:30:00.000Z'

const squad = {
  id: ID,
  code: 'VLR7K2',
  name: 'Ranked 5x5',
  game: { id: GAME_ID, name: 'Valorant', coverThumbUrl: 'https://cdn.example/cover.jpg' },
  platform: 'pc',
  host: { id: 'user-1', name: 'Diego' },
  memberCount: 4,
  maxPlayers: 5,
  createdAt: AT,
  lastActivityAt: AT,
}

const detail = {
  squad: {
    ...squad,
    language: 'pt-br',
    discordLink: 'https://discord.gg/ranked5x',
    members: [
      { id: 'user-1', name: 'Diego', image: null, isHost: true, joinedAt: AT },
      {
        id: 'user-2',
        name: 'Marina',
        image: 'https://cdn.example/m.png',
        isHost: false,
        joinedAt: AT,
      },
    ],
  },
}

describe('adminSquadsQuerySchema', () => {
  it('is the shared page query plus an optional search and game filter', () => {
    expect(adminSquadsQuerySchema.parse({})).toEqual({ page: 1 })
    expect(adminSquadsQuerySchema.parse({ page: '2', q: '  vlr ', gameId: GAME_ID })).toEqual({
      page: 2,
      q: 'vlr',
      gameId: GAME_ID,
    })
  })

  it('reads an empty q and an empty gameId as no filter', () => {
    expect(adminSquadsQuerySchema.parse({ q: '  ', gameId: '' })).toEqual({ page: 1 })
  })

  it('reads the sort, platform and language, and an empty value as absent', () => {
    expect(
      adminSquadsQuerySchema.parse({ sort: 'fullest', platform: 'ps5', language: 'en' })
    ).toEqual({ page: 1, sort: 'fullest', platform: 'ps5', language: 'en' })
    expect(adminSquadsQuerySchema.parse({ sort: '', platform: '', language: '' })).toEqual({
      page: 1,
    })
    for (const sort of ADMIN_SQUAD_SORTS) {
      expect(adminSquadsQuerySchema.parse({ sort }).sort).toBe(sort)
    }
  })

  it.each([
    ['a game that is not a uuid', { gameId: 'valorant' }],
    ['an unknown sort', { sort: 'popular' }],
    ['an unknown platform', { platform: 'atari' }],
    ['an unknown language', { language: 'fr' }],
    ['a search over 100 characters', { q: 'x'.repeat(101) }],
    ['a page below 1', { page: '0' }],
  ])('rejects %s', (_label, query) => {
    expect(adminSquadsQuerySchema.safeParse(query).success).toBe(false)
  })
})

describe('adminSquadsResponseSchema', () => {
  it('is the shared pagination response of Open Squads', () => {
    const body = { items: [squad], page: 1, pageSize: PAGE_SIZE, total: 1 }

    expect(adminSquadsResponseSchema.parse(body)).toEqual(body)
    expect(adminSquadSchema.parse(squad)).toEqual(squad)
  })

  it('never carries an email', () => {
    const parsed = adminSquadsResponseSchema.parse({
      items: [{ ...squad, host: { ...squad.host, email: 'a@b.c' } }],
      page: 1,
      pageSize: PAGE_SIZE,
      total: 1,
    })

    expect(JSON.stringify(parsed)).not.toContain('a@b.c')
  })
})

describe('adminSquadDetailResponseSchema', () => {
  it('carries the roster with the host marked and the full invite', () => {
    expect(adminSquadDetailResponseSchema.parse(detail)).toEqual(detail)
  })

  it('accepts a Squad with no invite and no platform', () => {
    const bare = { squad: { ...detail.squad, discordLink: null, platform: null } }

    expect(adminSquadDetailResponseSchema.parse(bare)).toEqual(bare)
  })
})

describe('closeSquadInputSchema', () => {
  it('trims the reason', () => {
    expect(closeSquadInputSchema.parse({ reason: '  Offensive name  ' })).toEqual({
      reason: 'Offensive name',
    })
  })

  it('accepts the shortest and the longest reason', () => {
    expect(ADMIN_CLOSURE_REASON_MIN).toBe(3)
    expect(ADMIN_CLOSURE_REASON_MAX).toBe(280)
    expect(closeSquadInputSchema.safeParse({ reason: 'abc' }).success).toBe(true)
    expect(closeSquadInputSchema.safeParse({ reason: 'x'.repeat(280) }).success).toBe(true)
  })

  it.each([
    ['a missing reason', {}],
    ['an empty reason', { reason: '' }],
    ['a reason that is short once trimmed', { reason: '  ab  ' }],
    ['a reason over 280 characters', { reason: 'x'.repeat(281) }],
    ['a reason that is not text', { reason: 12345 }],
  ])('rejects %s', (_label, body) => {
    expect(closeSquadInputSchema.safeParse(body).success).toBe(false)
  })
})

describe('room_closed_by_admin notification', () => {
  const payload = {
    roomId: ID,
    roomCode: 'VLR7K2',
    roomName: 'Ranked 5x5',
    gameName: 'Valorant',
    reason: 'Offensive name',
  }
  const notification = {
    id: ID,
    userId: 'user-1',
    type: 'room_closed_by_admin',
    title: 'Squad closed',
    message: 'Ranked 5x5 was closed by Squadzr moderation.',
    payload,
    readAt: null,
    createdAt: AT,
  }

  it('keeps the reason and never names the admin', () => {
    const parsed = userNotificationSchema.parse(notification)

    expect(parsed.payload).toEqual(payload)
    expect(
      userNotificationSchema.safeParse({
        ...notification,
        payload: { ...payload, reason: undefined },
      }).success
    ).toBe(false)
  })

  it('does not strip the reason when the payload is parsed through the payload union', () => {
    expect(userNotificationPayloadSchema.parse(payload)).toEqual(payload)
  })

  it('does not take the previous host off a room_closed payload', () => {
    const closed = {
      roomId: ID,
      roomCode: 'VLR7K2',
      roomName: 'Ranked 5x5',
      gameName: 'Valorant',
      previousHost: { name: 'Diego', image: null },
      reason: 'no_eligible_host',
    }

    expect(userNotificationPayloadSchema.parse(closed)).toEqual(closed)
  })

  it('rejects a payload of another type', () => {
    expect(
      userNotificationSchema.safeParse({
        ...notification,
        payload: { ...payload, previousHost: { name: 'Diego', image: null } },
      }).success
    ).toBe(false)
  })
})
