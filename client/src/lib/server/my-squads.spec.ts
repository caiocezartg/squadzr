import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { ApiContractError } from '@/lib/api-contract'
import { boardSquads } from '@/test/fixtures'
import { loadMySquads } from './my-squads'

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

const VIEWER = { cookie: 'better-auth.session_token=abc', forwardedFor: '203.0.113.7' }

const hosted = boardSquads.rooms[0]!
const joined = boardSquads.rooms[2]!
const MY_SQUADS = { hosted: [hosted], joined: [joined] }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('loadMySquads', () => {
  it('forwards the viewer cookie and client IP to Fastify', async () => {
    const fetchMock = stubFetch(jsonResponse(MY_SQUADS))

    await loadMySquads(VIEWER)

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_INTERNAL_URL}/api/rooms/my`)
    const headers = new Headers(sentInit(fetchMock).headers)
    expect(headers.get('cookie')).toBe(VIEWER.cookie)
    expect(headers.get('x-forwarded-for')).toBe(VIEWER.forwardedFor)
  })

  it('sends no cookie for a signed-out viewer', async () => {
    const fetchMock = stubFetch(jsonResponse(MY_SQUADS))

    await loadMySquads({ cookie: null, forwardedFor: null })

    const headers = new Headers(sentInit(fetchMock).headers)
    expect(headers.get('cookie')).toBeNull()
    expect(headers.get('x-forwarded-for')).toBeNull()
  })

  it('is never cached: the call opts out of the data cache and sets no revalidate', async () => {
    const fetchMock = stubFetch(jsonResponse(MY_SQUADS))

    await loadMySquads(VIEWER)

    expect(sentInit(fetchMock).cache).toBe('no-store')
    expect(sentInit(fetchMock).next).toBeUndefined()
  })

  it('parses the hosted and joined lists', async () => {
    stubFetch(jsonResponse(MY_SQUADS))

    await expect(loadMySquads(VIEWER)).resolves.toEqual(MY_SQUADS)
  })

  it('treats a 401 as signed out', async () => {
    stubFetch(jsonResponse({ error: 'UNAUTHORIZED', message: 'Unauthorized' }, 401))

    await expect(loadMySquads(VIEWER)).resolves.toBeNull()
  })

  it('throws when the list breaks the contract', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch(jsonResponse({ hosted: [{ ...hosted, maxPlayers: 'five' }], joined: [] }))

    await expect(loadMySquads(VIEWER)).rejects.toBeInstanceOf(ApiContractError)
  })

  it('throws on a failure that is not a 401', async () => {
    stubFetch(jsonResponse({ error: 'INTERNAL_ERROR', message: 'Database unavailable' }, 500))

    await expect(loadMySquads(VIEWER)).rejects.toThrow('Database unavailable')
  })
})
