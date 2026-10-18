import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { ApiClientError, ApiContractError } from '@/lib/api-contract'
import { loadSession } from './session'

const user = { id: 'user-1', name: 'Caio', email: 'caio@squadzr.test', image: null }

// Better Auth's authenticated answer carries more than the app reads; the loader keeps the user only.
const authenticatedBody = {
  session: { id: 'session-1', userId: 'user-1', expiresAt: '2026-10-25T12:00:00.000Z' },
  user: { ...user, emailVerified: false, createdAt: '2026-09-27T12:30:00.000Z' },
}

const GET_SESSION_URL = `${API_INTERNAL_URL}/api/auth/get-session?disableRefresh=true`

function stubFetch(body: string, status = 200) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(body, { status, headers: { 'content-type': 'application/json' } })
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('loadSession', () => {
  it('asks Better Auth for the session without renewing it', async () => {
    const fetchMock = stubFetch('null')

    await loadSession('better-auth.session_token=abc')

    expect(fetchMock.mock.calls[0]?.[0]).toBe(GET_SESSION_URL)
  })

  it("forwards the viewer's cookie", async () => {
    const fetchMock = stubFetch('null')

    await loadSession('better-auth.session_token=abc')

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(headers.get('cookie')).toBe('better-auth.session_token=abc')
  })

  it('is never cached', async () => {
    const fetchMock = stubFetch('null')

    await loadSession('better-auth.session_token=abc')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { next?: unknown }
    expect(init.cache).toBe('no-store')
    expect(init.next).toBeUndefined()
  })

  it('returns the user of an authenticated viewer', async () => {
    stubFetch(JSON.stringify(authenticatedBody))

    await expect(loadSession('better-auth.session_token=abc')).resolves.toEqual({ user })
  })

  it('returns null for a viewer Better Auth answers with a null body', async () => {
    stubFetch('null')

    await expect(loadSession(null)).resolves.toBeNull()
  })

  it('returns null for a 401', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Unauthorized' }), 401)

    await expect(loadSession('better-auth.session_token=expired')).resolves.toBeNull()
  })

  it('fails validation for an authenticated body without a user', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(JSON.stringify({ session: authenticatedBody.session }))

    await expect(loadSession('better-auth.session_token=abc')).rejects.toBeInstanceOf(
      ApiContractError
    )
  })

  it('does not treat a server failure as signed out', async () => {
    stubFetch(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Database unavailable' }), 500)

    const error = await loadSession('better-auth.session_token=abc').catch(
      (caught: unknown) => caught
    )

    expect(error).toBeInstanceOf(ApiClientError)
    expect(error).toMatchObject({ status: 500 })
  })
})
