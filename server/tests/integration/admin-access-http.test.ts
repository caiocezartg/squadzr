import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { sessionResponseSchema } from '@squadzr/schemas'
import { user } from '@infrastructure/database/schema'
import { signIn } from '@test/harness/auth'
import { get } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #117: the admin role. It reaches the session, the person cannot set it, and the guard of every
// `/api/admin/*` route refuses anyone who does not hold it, on the very next request.

let server: TestServer

beforeEach(async () => {
  server = await buildTestServer()
})

afterEach(async () => {
  await server.close()
})

describe('the admin guard on GET /api/admin/audit', () => {
  it('answers 401 UNAUTHORIZED to a signed-out visitor', async () => {
    const response = await get(server, '/api/admin/audit')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'UNAUTHORIZED', message: 'Authentication required' })
  })

  it('answers 401 to a session cookie that is not valid', async () => {
    const response = await server.app.inject({
      method: 'GET',
      url: '/api/admin/audit',
      headers: { cookie: 'better-auth.session_token=forged.signature' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('answers 403 ADMIN_REQUIRED to a user', async () => {
    const player = await signIn(server, 'Player')

    const response = await get(server, '/api/admin/audit', player)

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
  })

  it('lets an admin in', async () => {
    const admin = await signIn(server, 'Admin', { role: 'admin' })

    const response = await get(server, '/api/admin/audit', admin)

    expect(response.statusCode).toBe(200)
  })

  it('refuses a demoted admin on their next request', async () => {
    const admin = await signIn(server, 'Admin', { role: 'admin' })
    expect((await get(server, '/api/admin/audit', admin)).statusCode).toBe(200)

    await server.app.db.update(user).set({ role: 'user' }).where(eq(user.id, admin.id))

    const response = await get(server, '/api/admin/audit', admin)
    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
  })
})

describe('the role in the session', () => {
  async function readSession(headers: { cookie: string }) {
    const response = await server.app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers,
    })
    expect(response.statusCode).toBe(200)
    return sessionResponseSchema.parse(response.json())
  }

  it('is user by default and admin for an admin', async () => {
    const player = await signIn(server, 'Player')
    const admin = await signIn(server, 'Admin', { role: 'admin' })

    expect((await readSession(player.headers))?.user.role).toBe('user')
    expect((await readSession(admin.headers))?.user.role).toBe('admin')
  })

  it('cannot be set by a profile update', async () => {
    const player = await signIn(server, 'Player')

    const response = await server.app.inject({
      method: 'POST',
      url: '/api/auth/update-user',
      headers: { ...player.headers, origin: 'http://localhost:5173' },
      payload: { name: 'Renamed', role: 'admin' },
    })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
    const [stored] = await server.app.db.select().from(user).where(eq(user.id, player.id))
    expect(stored?.role).toBe('user')
    expect((await get(server, '/api/admin/audit', player)).statusCode).toBe(403)
  })

  it('stays user when a profile update sets only other fields', async () => {
    const player = await signIn(server, 'Player')

    const response = await server.app.inject({
      method: 'POST',
      url: '/api/auth/update-user',
      headers: { ...player.headers, origin: 'http://localhost:5173' },
      payload: { name: 'Renamed' },
    })

    expect(response.statusCode).toBe(200)
    const [stored] = await server.app.db.select().from(user).where(eq(user.id, player.id))
    expect(stored).toMatchObject({ name: 'Renamed', role: 'user' })
  })
})
