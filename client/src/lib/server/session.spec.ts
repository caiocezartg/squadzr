import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { ApiContractError } from '@/lib/api-contract'
import { getRequestSession } from './session'

const requestHeaders = vi.hoisted(() => ({
  cookie: null as string | null,
  forwardedFor: null as string | null,
}))

// The session loader reads the request headers; the suite supplies them per call.
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({
      ...(requestHeaders.cookie ? { cookie: requestHeaders.cookie } : {}),
      ...(requestHeaders.forwardedFor ? { 'x-forwarded-for': requestHeaders.forwardedFor } : {}),
    }),
}))

/** Reads the session of a request that carries `cookie` from `forwardedFor`. */
function readSession(cookie: string | null, forwardedFor: string | null = null) {
  requestHeaders.cookie = cookie
  requestHeaders.forwardedFor = forwardedFor
  return getRequestSession()
}

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

describe('getRequestSession', () => {
  it('asks Better Auth for the session without renewing it', async () => {
    const fetchMock = stubFetch('null')

    await readSession('better-auth.session_token=abc')

    expect(fetchMock.mock.calls[0]?.[0]).toBe(GET_SESSION_URL)
  })

  it("forwards the viewer's cookie", async () => {
    const fetchMock = stubFetch('null')

    await readSession('better-auth.session_token=abc')

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(headers.get('cookie')).toBe('better-auth.session_token=abc')
  })

  it('is never cached', async () => {
    const fetchMock = stubFetch('null')

    await readSession('better-auth.session_token=abc')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { next?: unknown }
    expect(init.cache).toBe('no-store')
    expect(init.next).toBeUndefined()
  })

  it('returns the user of an authenticated viewer', async () => {
    stubFetch(JSON.stringify(authenticatedBody))

    await expect(readSession('better-auth.session_token=abc')).resolves.toEqual({ user })
  })

  it('returns null for a viewer Better Auth answers with a null body', async () => {
    stubFetch('null')

    await expect(readSession(null)).resolves.toBeNull()
  })

  it('returns null for a 401', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Unauthorized' }), 401)

    await expect(readSession('better-auth.session_token=expired')).resolves.toBeNull()
  })

  it('fails validation for an authenticated body without a user', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(JSON.stringify({ session: authenticatedBody.session }))

    await expect(readSession('better-auth.session_token=abc')).rejects.toBeInstanceOf(
      ApiContractError
    )
  })

  it('retries a 5xx once and returns the session the retry reads', async () => {
    const fetchMock = stubFetchSequence(
      jsonResponse(serverError, 500),
      jsonResponse(authenticatedBody)
    )

    await expect(readSession('better-auth.session_token=abc')).resolves.toEqual({ user })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a network error once and returns the session the retry reads', async () => {
    const fetchMock = stubFetchSequence(
      new TypeError('fetch failed'),
      jsonResponse(authenticatedBody)
    )

    await expect(readSession('better-auth.session_token=abc')).resolves.toEqual({ user })
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

    await expect(readSession('better-auth.session_token=abc')).resolves.toEqual({ user })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('renders signed out and logs once when both tries fail', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetchSequence(
      new TypeError('fetch failed'),
      jsonResponse(serverError, 500)
    )

    await expect(readSession('better-auth.session_token=abc')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 401', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetch(
      JSON.stringify({ code: 'UNAUTHORIZED', message: 'Unauthorized' }),
      401
    )

    await expect(readSession('better-auth.session_token=expired')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders signed out on a 429 without retrying, and logs once', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetch(JSON.stringify({ message: 'Too many requests' }), 429)

    await expect(readSession('better-auth.session_token=abc')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0]?.[0])).toMatch(/Session read failed/)
  })

  it('logs once for a Better Auth { code, message } refusal', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetch(JSON.stringify({ code: 'FORBIDDEN', message: 'Forbidden' }), 403)

    await expect(readSession('better-auth.session_token=abc')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0]?.[0])).toMatch(/Session read failed/)
  })

  it('renders signed out on any other 4xx without retrying', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetch(JSON.stringify({ error: 'FORBIDDEN', message: 'Forbidden' }), 403)

    await expect(readSession('better-auth.session_token=abc')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("forwards the viewer's x-forwarded-for, and nothing when it has none", async () => {
    const fetchMock = stubFetch('null')

    await readSession('better-auth.session_token=abc', '203.0.113.7')
    await readSession('better-auth.session_token=abc')

    const sent = fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers))
    expect(sent[0]?.get('x-forwarded-for')).toBe('203.0.113.7')
    expect(sent[1]?.has('x-forwarded-for')).toBe(false)
  })

  it('does not retry a null body', async () => {
    const fetchMock = stubFetch('null')

    await expect(readSession(null)).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a malformed successful body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetch(JSON.stringify({ session: authenticatedBody.session }))

    await expect(readSession('better-auth.session_token=abc')).rejects.toBeInstanceOf(
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

    await readSession('better-auth.session_token=abc')

    expect(timeout.mock.calls).toEqual([[2000], [2000]])
    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(firstInit.signal).toBe(timeout.mock.results[0]?.value)
  })
})
