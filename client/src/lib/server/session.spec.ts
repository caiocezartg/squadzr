import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { ApiContractError } from '@/lib/api-contract'
import { loadSession } from './session'

const user = { id: 'user-1', name: 'Caio', email: 'caio@squadzr.test', image: null }

// Better Auth's authenticated answer carries more than the app reads; the loader keeps the user only.
const authenticatedBody = {
  session: { id: 'session-1', userId: 'user-1', expiresAt: '2026-10-25T12:00:00.000Z' },
  user: { ...user, emailVerified: false, createdAt: '2026-09-27T12:30:00.000Z' },
}

const serverError = { error: 'INTERNAL_ERROR', message: 'Database unavailable' }

const GET_SESSION_URL = `${API_INTERNAL_URL}/api/auth/get-session?disableRefresh=true`

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function stubFetch(body: string, status = 200) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(body, { status, headers: { 'content-type': 'application/json' } })
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Answers the calls in order: a Response is returned, an Error rejects the call like a network failure. */
function stubFetchSequence(...answers: Array<Response | Error>) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const answer = answers.shift()
    if (answer instanceof Response) return answer
    throw answer ?? new Error('fetch was called more times than the test expected')
  })
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

  it('retries a 5xx once and returns the session the retry reads', async () => {
    const fetchMock = stubFetchSequence(
      jsonResponse(serverError, 500),
      jsonResponse(authenticatedBody)
    )

    await expect(loadSession('better-auth.session_token=abc')).resolves.toEqual({ user })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a network error once and returns the session the retry reads', async () => {
    const fetchMock = stubFetchSequence(
      new TypeError('fetch failed'),
      jsonResponse(authenticatedBody)
    )

    await expect(loadSession('better-auth.session_token=abc')).resolves.toEqual({ user })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a try whose timeout fires before Fastify answers', async () => {
    // The first try's timeout has already fired, so its fetch rejects the way a timed-out call does.
    vi.spyOn(AbortSignal, 'timeout').mockImplementationOnce(() =>
      AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError'))
    )
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw init.signal.reason
      return jsonResponse(authenticatedBody)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadSession('better-auth.session_token=abc')).resolves.toEqual({ user })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('renders signed out and logs once when both tries fail', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetchSequence(
      new TypeError('fetch failed'),
      jsonResponse(serverError, 500)
    )

    await expect(loadSession('better-auth.session_token=abc')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 401', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetch(
      JSON.stringify({ code: 'UNAUTHORIZED', message: 'Unauthorized' }),
      401
    )

    await expect(loadSession('better-auth.session_token=expired')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a null body', async () => {
    const fetchMock = stubFetch('null')

    await expect(loadSession(null)).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a malformed successful body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetch(JSON.stringify({ session: authenticatedBody.session }))

    await expect(loadSession('better-auth.session_token=abc')).rejects.toBeInstanceOf(
      ApiContractError
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives each try its own two-second timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const fetchMock = stubFetchSequence(
      new TypeError('fetch failed'),
      jsonResponse(authenticatedBody)
    )

    await loadSession('better-auth.session_token=abc')

    expect(timeout.mock.calls).toEqual([[2000], [2000]])
    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(firstInit.signal).toBe(timeout.mock.results[0]?.value)
  })
})
