import type { LightMyRequestResponse } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { user } from '@infrastructure/database/schema'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-68: every Discord sign-in refreshes the stored name and avatar from the Discord profile.
// Only Discord's HTTP endpoints are stubbed; Better Auth runs its real sign-in and OAuth callback.

const CLIENT_ORIGIN = 'http://localhost:5173'
const CALLBACK_URL = `${CLIENT_ORIGIN}/`
const DISCORD_ACCESS_TOKEN = 'discord-access-token'

interface DiscordProfile {
  id: string
  username: string
  global_name: string
  avatar: string
  discriminator: string
  email: string
  verified: boolean
}

const PROFILE_BEFORE: DiscordProfile = {
  id: '80351110224678912',
  username: 'nightowl',
  global_name: 'Night Owl',
  avatar: '8342729096ea3675442027381ff50dfe',
  discriminator: '0',
  email: 'nightowl@squadzr.test',
  verified: true,
}

// The same Discord account (id and email) after a new display name and avatar.
const PROFILE_AFTER: DiscordProfile = {
  ...PROFILE_BEFORE,
  global_name: 'Night Owl Pro',
  avatar: 'c3a1f0e2b7d94a56be08f1d2c4a9e7b3',
}

function avatarUrl(profile: DiscordProfile): string {
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
}

/**
 * Stubs Discord's token and profile endpoints; every other host reaches the real fetch.
 * The profile is read on each request, so a test can switch the Discord account between sign-ins.
 */
function stubDiscord(currentProfile: () => DiscordProfile): void {
  const realFetch = globalThis.fetch

  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (url.origin !== 'https://discord.com') return realFetch(input, init)

    // Better Auth percent-encodes the "@" of "/users/@me"; compare the decoded path.
    const path = decodeURIComponent(url.pathname)
    if (path === '/api/oauth2/token') {
      return Response.json({
        access_token: DISCORD_ACCESS_TOKEN,
        token_type: 'Bearer',
        expires_in: 604_800,
        refresh_token: 'discord-refresh-token',
        scope: 'identify email',
      })
    }
    if (path === '/api/users/@me') {
      const authorization = new Headers(init?.headers).get('authorization')
      if (authorization !== `Bearer ${DISCORD_ACCESS_TOKEN}`) {
        return new Response(null, { status: 401 })
      }
      return Response.json(currentProfile())
    }
    return new Response(null, { status: 404 })
  })
}

/** The Cookie header a browser sends back for the Set-Cookie headers of a response. */
function cookieHeader(response: LightMyRequestResponse): string {
  const setCookies = [response.headers['set-cookie'] ?? []].flat().map(String)
  return setCookies.map((setCookie) => setCookie.split(';')[0]).join('; ')
}

/** Starts Discord sign-in the way the client does, keeping the state cookie and OAuth state. */
async function startDiscordSignIn(server: TestServer) {
  const response = await server.app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/social',
    headers: { origin: CLIENT_ORIGIN },
    payload: { provider: 'discord', callbackURL: CALLBACK_URL },
  })
  expect(response.statusCode).toBe(200)

  const { url }: { url: string } = response.json()
  const state = new URL(url).searchParams.get('state')
  if (!state) throw new Error('Discord authorization URL carries no state')

  return { cookie: cookieHeader(response), state }
}

/** Completes a Discord sign-in: Better Auth's authorize start, then its real OAuth callback. */
async function signInWithDiscord(server: TestServer): Promise<void> {
  const { cookie, state } = await startDiscordSignIn(server)

  const callback = await server.app.inject({
    method: 'GET',
    url: `/api/auth/callback/discord?code=discord-auth-code&state=${state}`,
    headers: { cookie },
  })

  expect(callback.statusCode).toBe(302)
  expect(callback.headers.location).toBe(CALLBACK_URL)
}

/** Reads the user table directly, so the assertions see what was persisted. */
function storedUsers(server: TestServer) {
  return server.app.db.select({ name: user.name, image: user.image }).from(user)
}

describe('Discord sign-in', () => {
  let server: TestServer
  let discordProfile: DiscordProfile

  beforeEach(async () => {
    discordProfile = PROFILE_BEFORE
    stubDiscord(() => discordProfile)
    server = await buildTestServer()
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await server.close()
  })

  it('refreshes the stored name and avatar on every sign-in', async () => {
    await signInWithDiscord(server)
    expect(await storedUsers(server)).toEqual([
      { name: 'Night Owl', image: avatarUrl(PROFILE_BEFORE) },
    ])

    discordProfile = PROFILE_AFTER
    await signInWithDiscord(server)

    // One row: the second sign-in updates the existing user instead of creating another.
    expect(await storedUsers(server)).toEqual([
      { name: 'Night Owl Pro', image: avatarUrl(PROFILE_AFTER) },
    ])
  })
})
