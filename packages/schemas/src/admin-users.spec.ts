import { describe, expect, it } from 'vitest'
import {
  ADMIN_USER_LATEST_COMPLETED_LIMIT,
  ADMIN_USER_SEARCH_MAX_LENGTH,
  PAGE_SIZE,
  adminUserDetailSchema,
  adminUserListItemSchema,
  adminUserParamsSchema,
  adminUserResponseSchema,
  adminUsersQuerySchema,
  adminUsersResponseSchema,
  changeUserRoleInputSchema,
  changeUserRoleResponseSchema,
} from './index'

const JOINED_AT = '2026-10-01T12:00:00.000Z'

const game = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  name: 'Valorant',
  slug: 'valorant',
  coverUrl: 'https://cdn.example/valorant.png',
  coverThumbUrl: 'https://cdn.example/valorant-thumb.png',
}

const person = {
  id: 'user-1',
  name: 'Marina Rocha',
  image: null,
  discordId: '284917263100001173',
  joinedAt: JOINED_AT,
  role: 'user',
}

const detail = {
  ...person,
  online: true,
  squadLimits: { held: { used: 2, limit: 3 }, hosted: { used: 1, limit: 1 } },
  openSquads: [
    {
      id: 'squad-1',
      code: 'VLR7K2',
      name: 'Ranked 5x5',
      game,
      memberCount: 4,
      maxPlayers: 5,
      isHost: false,
    },
  ],
  completedSquads: 47,
  gamesPlayed: 6,
  latestCompleted: [
    { id: 'record-1', name: 'Premier', game, maxPlayers: 5, readyAt: '2026-11-04T10:00:00.000Z' },
  ],
}

describe('adminUsersQuerySchema', () => {
  it('defaults to the first page with no search', () => {
    expect(adminUsersQuerySchema.parse({})).toEqual({ page: 1 })
  })

  it('coerces the page and trims the search', () => {
    expect(adminUsersQuerySchema.parse({ page: '2', q: '  mari  ' })).toEqual({
      page: 2,
      q: 'mari',
    })
  })

  it('refuses a page below 1 and a search past its bound', () => {
    expect(adminUsersQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(
      adminUsersQuerySchema.safeParse({ q: 'x'.repeat(ADMIN_USER_SEARCH_MAX_LENGTH + 1) }).success
    ).toBe(false)
  })
})

describe('adminUserParamsSchema', () => {
  it('needs an id of at most 255 characters', () => {
    expect(adminUserParamsSchema.safeParse({ id: 'user-1' }).success).toBe(true)
    expect(adminUserParamsSchema.safeParse({ id: '' }).success).toBe(false)
    expect(adminUserParamsSchema.safeParse({ id: 'x'.repeat(256) }).success).toBe(false)
  })
})

describe('adminUsersResponseSchema', () => {
  it('carries the shared pagination envelope around the rows', () => {
    const body = {
      items: [{ ...person, role: 'admin', openSquads: 2 }],
      page: 1,
      pageSize: PAGE_SIZE,
      total: 1,
    }

    expect(adminUsersResponseSchema.parse(body)).toEqual(body)
  })

  it('accepts a user without a Discord account or a photo', () => {
    const row = { ...person, discordId: null, image: null, openSquads: 0 }

    expect(adminUserListItemSchema.safeParse(row).success).toBe(true)
  })

  it('never carries an email: an extra field is dropped, not exposed', () => {
    const parsed = adminUserListItemSchema.parse({
      ...person,
      openSquads: 0,
      email: 'marina@example.com',
    })

    expect(parsed).not.toHaveProperty('email')
  })

  it.each([
    ['an unknown role', { ...person, role: 'superuser', openSquads: 0 }],
    ['a negative Open Squads count', { ...person, openSquads: -1 }],
    ['a joined date that is not ISO', { ...person, joinedAt: 'yesterday', openSquads: 0 }],
  ])('rejects %s', (_, row) => {
    expect(adminUserListItemSchema.safeParse(row).success).toBe(false)
  })
})

describe('adminUserResponseSchema', () => {
  it('parses a user page: online state, Squad Limits usage, Open Squads and history', () => {
    const parsed = adminUserResponseSchema.parse({ user: detail })

    expect(parsed.user.squadLimits).toEqual({
      held: { used: 2, limit: 3 },
      hosted: { used: 1, limit: 1 },
    })
    expect(parsed.user.openSquads[0]).toMatchObject({ code: 'VLR7K2', isHost: false })
    expect(parsed.user.latestCompleted).toHaveLength(1)
  })

  it('never carries an email', () => {
    const parsed = adminUserDetailSchema.parse({ ...detail, email: 'marina@example.com' })

    expect(parsed).not.toHaveProperty('email')
  })

  it('lists at most the latest five completed Squads', () => {
    const six = Array.from({ length: ADMIN_USER_LATEST_COMPLETED_LIMIT + 1 }, (_, index) => ({
      ...detail.latestCompleted[0],
      id: `record-${index}`,
    }))

    expect(adminUserDetailSchema.safeParse({ ...detail, latestCompleted: six }).success).toBe(false)
  })

  it('needs the online flag and both limits', () => {
    const { online: _online, ...withoutOnline } = detail
    const { squadLimits: _limits, ...withoutLimits } = detail

    expect(adminUserDetailSchema.safeParse(withoutOnline).success).toBe(false)
    expect(adminUserDetailSchema.safeParse(withoutLimits).success).toBe(false)
  })
})

describe('changeUserRoleInputSchema', () => {
  it.each(['user', 'moderator', 'admin'])('accepts the role %s and no reason', (role) => {
    expect(changeUserRoleInputSchema.parse({ role })).toEqual({ role })
  })

  it.each([{}, { role: 'owner' }, { role: '' }])(
    'rejects %j (owner is never handed out)',
    (body) => {
      expect(changeUserRoleInputSchema.safeParse(body).success).toBe(false)
    }
  )

  it('answers with the changed user', () => {
    const body = { user: { ...person, role: 'admin' } }

    expect(changeUserRoleResponseSchema.parse(body)).toEqual(body)
  })
})
