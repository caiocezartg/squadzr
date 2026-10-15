import type { LightMyRequestResponse } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Env } from '@config/env'
import { session } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-74: the session cookie's parent domain and its renewal. Better Auth issues the cookie from
// its own `get-session` endpoint, so these tests read the Set-Cookie header it really sends.

const SESSION_COOKIE = 'better-auth.session_token'
const DAY_MS = 24 * 60 * 60 * 1000
const PARENT_DOMAIN = 'squadzr.app'

type CookieAttributes = Record<string, string | true>

/**
 * Attributes of the session cookie a response sets, keyed by lowercase name. Flags such as
 * `Secure` map to `true`.
 */
function sessionCookieAttributes(response: LightMyRequestResponse): CookieAttributes | undefined {
  const setCookies = [response.headers['set-cookie'] ?? []].flat().map(String)
  const setCookie = setCookies.find((value) => value.startsWith(`${SESSION_COOKIE}=`))
  if (!setCookie) return undefined

  const [, ...attributes] = setCookie.split(';').map((part) => part.trim())
  return Object.fromEntries(
    attributes.map((attribute): [string, string | true] => {
      const [name = '', ...value] = attribute.split('=')
      return [name.toLowerCase(), value.length > 0 ? value.join('=') : true]
    })
  )
}

/**
 * Ages the player's session two days, past the one-day renewal age, and keeps it inside Better
 * Auth's seven-day lifetime, so the next `get-session` renews it. Returns the stored expiry.
 */
async function ageSession(server: TestServer, player: TestUser): Promise<Date> {
  const createdAt = new Date(Date.now() - 2 * DAY_MS)
  const expiresAt = new Date(createdAt.getTime() + 7 * DAY_MS)

  await server.app.db
    .update(session)
    .set({ createdAt, updatedAt: createdAt, expiresAt })
    .where(eq(session.userId, player.id))

  return expiresAt
}

/** The expiry stored for the player's session, read back from the database. */
async function storedExpiry(server: TestServer, player: TestUser): Promise<Date> {
  const [row] = await server.app.db
    .select({ expiresAt: session.expiresAt })
    .from(session)
    .where(eq(session.userId, player.id))

  if (!row) throw new Error(`No session stored for user ${player.id}`)
  return row.expiresAt
}

/**
 * Renews an aged session on a production server built with `overrides`, then returns the
 * attributes of the cookie that `get-session` sets.
 */
async function renewedCookieInProduction(
  overrides: Partial<Env>
): Promise<CookieAttributes | undefined> {
  const server = await buildTestServer({ NODE_ENV: 'production', ...overrides })
  try {
    const player = await signIn(server)
    await ageSession(server, player)

    const response = await server.app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: player.headers,
    })

    expect(response.statusCode).toBe(200)
    return sessionCookieAttributes(response)
  } finally {
    await server.close()
  }
}

describe('session cookie attributes in production', () => {
  it('sets Domain, SameSite=Lax and Secure when BETTER_AUTH_COOKIE_DOMAIN is set', async () => {
    const attributes = await renewedCookieInProduction({ BETTER_AUTH_COOKIE_DOMAIN: PARENT_DOMAIN })

    expect(attributes).toMatchObject({ domain: PARENT_DOMAIN, samesite: 'Lax', secure: true })
  })

  it('keeps the production attributes when BETTER_AUTH_COOKIE_DOMAIN is unset', async () => {
    const attributes = await renewedCookieInProduction({})

    expect(attributes).toMatchObject({ samesite: 'None', secure: true })
    expect(attributes).not.toHaveProperty('domain')
  })
})

describe('session renewal', () => {
  let server: TestServer

  beforeEach(async () => {
    server = await buildTestServer()
  })

  afterEach(async () => {
    await server.close()
  })

  it('renews nothing on an API request, then renews the cookie on get-session', async () => {
    const player = await signIn(server, 'Player')
    const dueExpiry = await ageSession(server, player)

    const apiResponse = await server.app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: player.headers,
    })

    expect(apiResponse.statusCode).toBe(200)
    expect(apiResponse.headers['set-cookie']).toBeUndefined()
    expect(await storedExpiry(server, player)).toEqual(dueExpiry)

    const sessionResponse = await server.app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: player.headers,
    })

    expect(sessionResponse.statusCode).toBe(200)
    const attributes = sessionCookieAttributes(sessionResponse)
    expect(Number(attributes?.['max-age'])).toBeGreaterThan(6 * 24 * 60 * 60)
    expect((await storedExpiry(server, player)).getTime()).toBeGreaterThan(dueExpiry.getTime())
  })
})
