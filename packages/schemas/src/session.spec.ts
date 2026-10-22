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
    emailVerified: false,
    createdAt: '2026-09-27T12:30:00.000Z',
    updatedAt: '2026-09-27T12:30:00.000Z',
  },
}

describe('sessionResponseSchema', () => {
  it('keeps the viewer id, name, email and image and strips the rest of the response', () => {
    expect(sessionResponseSchema.parse(authenticated)).toEqual({
      user: { id: 'user-1', name: 'Caio', email: 'caio@squadzr.test', image: null },
    })
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
    ['an undefined body', undefined],
  ])('rejects %s', (_, body) => {
    expect(sessionResponseSchema.safeParse(body).success).toBe(false)
  })
})
