import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { API_INTERNAL_URL } from '@/env.server'
import { ApiClientError, ApiContractError } from '@/lib/api-contract'
import { serverApi } from './api'

const schema = z.object({ ok: z.boolean() })

type RecordedInit = RequestInit & { next?: { revalidate?: number } }

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function sentInit(fetchMock: ReturnType<typeof stubFetch>): RecordedInit {
  return fetchMock.mock.calls[0]?.[1] as RecordedInit
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('serverApi.get credentials', () => {
  it('sends no cookie on an anonymous call', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))

    await serverApi.get('/api/public', schema, { credentials: 'anonymous', caching: 'uncached' })

    expect(new Headers(sentInit(fetchMock).headers).has('cookie')).toBe(false)
  })

  it("forwards the incoming request's cookie on a viewer call", async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))

    await serverApi.get('/api/me', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: 'better-auth.session_token=abc',
    })

    expect(new Headers(sentInit(fetchMock).headers).get('cookie')).toBe(
      'better-auth.session_token=abc'
    )
  })

  it('sends no cookie header for a viewer who has none', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))

    await serverApi.get('/api/me', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: null,
    })

    expect(new Headers(sentInit(fetchMock).headers).has('cookie')).toBe(false)
  })

  it("forwards the incoming request's x-forwarded-for on a viewer call", async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))

    await serverApi.get('/api/me', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: null,
      forwardedFor: '203.0.113.7, 10.0.0.1',
    })

    expect(new Headers(sentInit(fetchMock).headers).get('x-forwarded-for')).toBe(
      '203.0.113.7, 10.0.0.1'
    )
  })

  it('sends no x-forwarded-for for a viewer request that has none', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ ok: true })
    )
    vi.stubGlobal('fetch', fetchMock)

    await serverApi.get('/api/me', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: 'a=b',
      forwardedFor: null,
    })
    await serverApi.get('/api/me', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: 'a=b',
    })

    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).has('x-forwarded-for')).toBe(false)
    }
  })

  it('never sends x-forwarded-for on an anonymous call', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))
    // A viewer-only field slipping past the types must not leak into an anonymous call.
    const policy = {
      credentials: 'anonymous',
      caching: 'uncached',
      forwardedFor: '203.0.113.7',
    } as const

    await serverApi.get('/api/public', schema, policy)

    expect(new Headers(sentInit(fetchMock).headers).has('x-forwarded-for')).toBe(false)
  })

  it('calls the internal API URL with the path and its query', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))

    await serverApi.get('/api/rooms?page=2', schema, {
      credentials: 'anonymous',
      caching: 'uncached',
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_INTERNAL_URL}/api/rooms?page=2`)
  })
})

describe('serverApi.get caching', () => {
  it('revalidates an anonymous call for five minutes', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))

    await serverApi.get('/api/public', schema, { credentials: 'anonymous', caching: 'revalidated' })

    expect(sentInit(fetchMock).next).toEqual({ revalidate: 300 })
    expect(sentInit(fetchMock).cache).toBeUndefined()
  })

  it('reads an uncached anonymous call on every request', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))

    await serverApi.get('/api/public', schema, { credentials: 'anonymous', caching: 'uncached' })

    expect(sentInit(fetchMock).cache).toBe('no-store')
    expect(sentInit(fetchMock).next).toBeUndefined()
  })

  it('never caches a viewer call', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))

    await serverApi.get('/api/me', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: 'a=b',
    })

    expect(sentInit(fetchMock).cache).toBe('no-store')
    expect(sentInit(fetchMock).next).toBeUndefined()
  })

  it('reads a viewer call on every request even if a revalidated policy slips past the types', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))
    const policy = { credentials: 'viewer', caching: 'revalidated', cookie: 'a=b' } as const

    // @ts-expect-error only anonymous responses may be revalidated
    await serverApi.get('/api/me', schema, policy)

    expect(sentInit(fetchMock).cache).toBe('no-store')
    expect(sentInit(fetchMock).next).toBeUndefined()
  })
})

describe('serverApi.get contracts', () => {
  it('returns the body parsed with the caller schema', async () => {
    stubFetch(jsonResponse({ ok: true, extra: 'dropped' }))

    await expect(
      serverApi.get('/api/public', schema, { credentials: 'anonymous', caching: 'uncached' })
    ).resolves.toEqual({ ok: true })
  })

  it('throws ApiContractError for a successful body that breaks its schema', async () => {
    stubFetch(jsonResponse({ ok: 'yes' }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const error = await serverApi
      .get('/api/public', schema, { credentials: 'anonymous', caching: 'uncached' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiContractError)
    expect(error).toMatchObject({ status: 200, path: '/api/public' })
  })

  it('maps an error body in the shared error contract to ApiClientError', async () => {
    stubFetch(jsonResponse({ error: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404))

    const error = await serverApi
      .get('/api/rooms/ABC123', schema, { credentials: 'anonymous', caching: 'uncached' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiClientError)
    expect(error).toMatchObject({ status: 404, code: 'ROOM_NOT_FOUND', message: 'Room not found' })
  })

  it('throws ApiContractError when the body cannot be read on a call without a timeout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = jsonResponse({ ok: true })
    vi.spyOn(response, 'text').mockRejectedValue(new TypeError('terminated'))
    stubFetch(response)

    const error = await serverApi
      .get('/api/public', schema, { credentials: 'anonymous', caching: 'uncached' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiContractError)
    expect(error).toMatchObject({ status: 200, path: '/api/public' })
  })

  it('rethrows a body read that fails on a call with a timeout, so the caller can retry it', async () => {
    const response = jsonResponse({ ok: true })
    const timedOut = new DOMException('The operation timed out.', 'TimeoutError')
    vi.spyOn(response, 'text').mockRejectedValue(timedOut)
    stubFetch(response)

    await expect(
      serverApi.get(
        '/api/public',
        schema,
        { credentials: 'anonymous', caching: 'uncached' },
        { timeoutMs: 2000 }
      )
    ).rejects.toBe(timedOut)
  })

  it('throws ApiContractError for an error body outside the error contract', async () => {
    stubFetch(jsonResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const error = await serverApi
      .get('/api/me', schema, { credentials: 'viewer', caching: 'uncached', cookie: null })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiContractError)
    expect(error).toMatchObject({ status: 401 })
  })
})
