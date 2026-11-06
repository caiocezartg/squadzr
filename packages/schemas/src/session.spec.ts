import { describe, expect, it } from 'vitest'
import { sessionResponseSchema } from './index'

const authenticated = {
  session: {
    id: 'session-1',
    userId: 'user-1',
    token: 'secret-token',
    expiresAt: '2026-10-25T12:00:00.000Z',
  },
  user: {
    id: 'user-1',
    name: 'Caio',
    email: 'caio@squadzr.test',
    image: null,
    role: 'user',
    emailVerified: false,
    createdAt: '2026-09-27T12:30:00.000Z',
    updatedAt: '2026-09-27T12:30:00.000Z',
  },
}

describe('sessionResponseSchema', () => {
  it('keeps the viewer id, name, email, image and role and strips the rest of the response', () => {
    expect(sessionResponseSchema.parse(authenticated)).toEqual({
      user: { id: 'user-1', name: 'Caio', email: 'caio@squadzr.test', image: null, role: 'user' },
    })
  })

  it.each(['moderator', 'admin', 'owner'])('keeps the %s role', (role) => {
    const response = { user: { ...authenticated.user, role } }

    expect(sessionResponseSchema.parse(response)).toMatchObject({ user: { role } })
  })

  it('keeps a Discord avatar URL', () => {
    const response = { user: { ...authenticated.user, image: 'https://cdn.discordapp.com/a.png' } }

    expect(sessionResponseSchema.parse(response)).toMatchObject({
      user: { image: 'https://cdn.discordapp.com/a.png' },
    })
  })

  it('accepts a JSON null body as a signed-out viewer', () => {
    expect(sessionResponseSchema.parse(null)).toBeNull()
  })

  it.each([
    ['a body without a user', { session: authenticated.session }],
    ['a user without an email address', { user: { ...authenticated.user, email: 'caio' } }],
    ['a user without an image key', { user: { ...authenticated.user, image: undefined } }],
    ['a user without a role', { user: { ...authenticated.user, role: undefined } }],
    ['a user with an unknown role', { user: { ...authenticated.user, role: 'superuser' } }],
    ['an undefined body', undefined],
  ])('rejects %s', (_, body) => {
    expect(sessionResponseSchema.safeParse(body).success).toBe(false)
  })
})
