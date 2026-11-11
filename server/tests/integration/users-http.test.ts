import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { userResponseSchema } from '@squadzr/schemas'
import { signIn } from '@test/harness/auth'
import { get } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-63: the profile route resolves the caller from the authentication hook's userId.

let server: TestServer

beforeEach(async () => {
  server = await buildTestServer()
})

afterEach(async () => {
  await server.close()
})

describe('GET /api/users/me', () => {
  it('returns the authenticated user profile', async () => {
    const user = await signIn(server, 'Caller')

    const response = await get(server, '/api/users/me', user)

    expect(response.statusCode).toBe(200)
    expect(userResponseSchema.parse(response.json()).user).toMatchObject({
      id: user.id,
      name: 'Caller',
      email: user.email,
      image: user.image,
    })
  })

  it('requires authentication', async () => {
    const response = await get(server, '/api/users/me')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'UNAUTHORIZED', message: 'Authentication required' })
  })
})
