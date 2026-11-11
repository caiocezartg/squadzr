import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { headers } from 'next/headers'
import { serverApi } from './api'

const schema = z.object({ ok: z.boolean() })
const headersMock = vi.mocked(headers)

function visitorBehindCloudflare(address: string | undefined) {
  headersMock.mockResolvedValue(
    new Headers(address ? { 'cf-connecting-ip': address } : {}) as Awaited<
      ReturnType<typeof headers>
    >
  )
}

function stubFetch() {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{"ok":true}')
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentHeaders(fetchMock: ReturnType<typeof stubFetch>, call = 0) {
  return new Headers(fetchMock.mock.calls[call]?.[1]?.headers)
}

beforeEach(() => {
  headersMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('serverApi.get visitor address', () => {
  it('forwards it as x-real-ip on a viewer call, so the API counts the visitor and not the Worker', async () => {
    const fetchMock = stubFetch()
    visitorBehindCloudflare('2804:1b3:aa80:d188:64ed:92bf:8a0f:2787')

    await serverApi.get('/api/rooms', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: 'a=b',
    })

    expect(sentHeaders(fetchMock).get('x-real-ip')).toBe('2804:1b3:aa80:d188:64ed:92bf:8a0f:2787')
  })

  it('forwards it on a viewer call without a cookie too', async () => {
    const fetchMock = stubFetch()
    visitorBehindCloudflare('203.0.113.9')

    await serverApi.get('/api/auth/get-session', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: null,
    })

    expect(sentHeaders(fetchMock).get('x-real-ip')).toBe('203.0.113.9')
  })

  it('never forwards it on an anonymous call, so a response Next shares is not split per visitor', async () => {
    const fetchMock = stubFetch()
    visitorBehindCloudflare('203.0.113.9')

    await serverApi.get('/api/games/popular', schema, {
      credentials: 'anonymous',
      caching: 'revalidated',
    })
    await serverApi.get('/api/rooms/ABC123', schema, {
      credentials: 'anonymous',
      caching: 'uncached',
    })

    expect(sentHeaders(fetchMock, 0).has('x-real-ip')).toBe(false)
    expect(sentHeaders(fetchMock, 1).has('x-real-ip')).toBe(false)
  })

  it('sends nothing when the request has no usable address', async () => {
    const fetchMock = stubFetch()
    visitorBehindCloudflare(undefined)
    await serverApi.get('/api/rooms', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: null,
    })

    headersMock.mockResolvedValue(
      new Headers({ 'cf-connecting-ip': 'garbage' }) as Awaited<ReturnType<typeof headers>>
    )
    await serverApi.get('/api/rooms', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: null,
    })

    expect(sentHeaders(fetchMock, 0).has('x-real-ip')).toBe(false)
    expect(sentHeaders(fetchMock, 1).has('x-real-ip')).toBe(false)
  })
})
