import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { ApiContractError } from '@/lib/api-contract'
import { popularGames } from '@/test/fixtures'
import { loadPopularGames } from './games'

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
  vi.restoreAllMocks()
})

describe('loadPopularGames', () => {
  it('returns the total and the games the response carries, parsed against the contract', async () => {
    const fetchMock = stubFetch(jsonResponse(popularGames))

    await expect(loadPopularGames()).resolves.toEqual(popularGames)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_INTERNAL_URL}/api/games/popular`)
  })

  it('sends no cookie', async () => {
    const fetchMock = stubFetch(jsonResponse(popularGames))

    await loadPopularGames()

    expect(new Headers(sentInit(fetchMock).headers).has('cookie')).toBe(false)
  })

  it('is revalidated every five minutes', async () => {
    const fetchMock = stubFetch(jsonResponse(popularGames))

    await loadPopularGames()

    expect(sentInit(fetchMock).next).toEqual({ revalidate: 300 })
  })

  it('renders without games when the read fails, and logs the failure once', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch(jsonResponse({ error: 'INTERNAL', message: 'Database is down' }, 500))

    await expect(loadPopularGames()).resolves.toEqual({ totalGames: 0, games: [] })
    expect(consoleError).toHaveBeenCalledTimes(1)
  })

  it('throws when a 2xx body breaks the contract, so the page does not render a bad list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch(jsonResponse({ totalGames: 2, games: [{ game: { id: 'not-a-uuid' } }] }))

    await expect(loadPopularGames()).rejects.toBeInstanceOf(ApiContractError)
  })
})
