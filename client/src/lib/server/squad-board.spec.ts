import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { ApiContractError } from '@/lib/api-contract'
import { boardSquads, squadsForPagination } from '@/test/fixtures'
import { loadSquadBoard } from './squad-board'

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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('loadSquadBoard', () => {
  it('forwards the viewer cookie and client IP to Fastify', async () => {
    const fetchMock = stubFetch(jsonResponse(boardSquads))

    await loadSquadBoard(VIEWER)

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_INTERNAL_URL}/api/rooms`)
    const headers = new Headers(sentInit(fetchMock).headers)
    expect(headers.get('cookie')).toBe(VIEWER.cookie)
    expect(headers.get('x-forwarded-for')).toBe(VIEWER.forwardedFor)
  })

  it('sends no cookie for a signed-out viewer', async () => {
    const fetchMock = stubFetch(jsonResponse(boardSquads))

    await loadSquadBoard({ cookie: null, forwardedFor: null })

    const headers = new Headers(sentInit(fetchMock).headers)
    expect(headers.get('cookie')).toBeNull()
    expect(headers.get('x-forwarded-for')).toBeNull()
  })

  it('is never cached: the call opts out of the data cache and sets no revalidate', async () => {
    const fetchMock = stubFetch(jsonResponse(boardSquads))

    await loadSquadBoard(VIEWER)

    expect(sentInit(fetchMock).cache).toBe('no-store')
    expect(sentInit(fetchMock).next).toBeUndefined()
  })

  it('parses the complete list, not a page of it', async () => {
    const complete = squadsForPagination()
    stubFetch(jsonResponse(complete))

    const response = await loadSquadBoard(VIEWER)

    expect(response.rooms.map((squad) => squad.id)).toEqual(complete.rooms.map((squad) => squad.id))
  })

  it('throws when the list breaks the contract', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch(jsonResponse({ rooms: [{ ...boardSquads.rooms[0], maxPlayers: 'five' }] }))

    await expect(loadSquadBoard(VIEWER)).rejects.toBeInstanceOf(ApiContractError)
  })
})
