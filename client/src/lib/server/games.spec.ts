import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { ApiContractError } from '@/lib/api-contract'
import { catalogGames, gameCs2, gameLol } from '@/test/fixtures'
import { loadGames, pickPopularGames } from './games'

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

describe('loadGames', () => {
  it('returns the games the list response carries, parsed against the contract', async () => {
    const fetchMock = stubFetch(jsonResponse(catalogGames))

    await expect(loadGames()).resolves.toEqual([gameLol, gameCs2])
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_INTERNAL_URL}/api/games`)
  })

  it('sends no cookie', async () => {
    const fetchMock = stubFetch(jsonResponse(catalogGames))

    await loadGames()

    expect(new Headers(sentInit(fetchMock).headers).has('cookie')).toBe(false)
  })

  it('is revalidated every five minutes', async () => {
    const fetchMock = stubFetch(jsonResponse(catalogGames))

    await loadGames()

    expect(sentInit(fetchMock).next).toEqual({ revalidate: 300 })
  })

  it('renders without games when the read fails, and logs the failure once', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch(jsonResponse({ error: 'INTERNAL', message: 'Database is down' }, 500))

    await expect(loadGames()).resolves.toEqual([])
    expect(consoleError).toHaveBeenCalledTimes(1)
  })

  it('throws when a 2xx body breaks the contract, so the page does not render a bad list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch(jsonResponse({ games: [{ id: 'not-a-uuid' }] }))

    await expect(loadGames()).rejects.toBeInstanceOf(ApiContractError)
  })
})

describe('pickPopularGames', () => {
  it('shows at most eight games', () => {
    const games = Array.from({ length: 12 }, (_, index) => ({ ...gameLol, name: `Game ${index}` }))

    expect(pickPopularGames(games, () => 0.5)).toHaveLength(8)
  })

  it('orders the games by the random source it is given and keeps the list it was given', () => {
    const games = [gameLol, gameCs2]

    expect(pickPopularGames(games, () => 0)).toEqual([gameCs2, gameLol])
    expect(pickPopularGames(games, () => 0.99)).toEqual([gameLol, gameCs2])
    expect(games).toEqual([gameLol, gameCs2])
  })
})
