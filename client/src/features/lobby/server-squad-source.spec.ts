import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { gameLol, lobbySquad, lobbySquadResponse } from '@/test/fixtures'
import { prefetchLobby } from './prefetch-lobby'
import { viewerSquadSource } from './server-squad-source'
import { readSquadDetails, squadQueryKey } from './squad-details'

type RecordedInit = RequestInit & { next?: { revalidate?: number } }

const viewer = { cookie: 'better-auth.session_token=abc', forwardedFor: '203.0.113.7' }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Answers the Squad read and the game read by path, and records every call. */
function stubReads(squad: Response, game: Response = jsonResponse({ game: gameLol })) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith(`${API_INTERNAL_URL}/api/rooms/`)) return squad.clone()
    if (url.startsWith(`${API_INTERNAL_URL}/api/games/`)) return game.clone()
    throw new Error(`Unexpected read: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentInit(fetchMock: ReturnType<typeof stubReads>, index: number): RecordedInit {
  return fetchMock.mock.calls[index]?.[1] as RecordedInit
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the Lobby loader for a viewer', () => {
  it("forwards the viewer's cookie and address on the Squad read", async () => {
    const fetchMock = stubReads(jsonResponse(lobbySquadResponse))

    await readSquadDetails(viewerSquadSource(viewer), lobbySquad.code)

    const headers = new Headers(sentInit(fetchMock, 0).headers)
    expect(headers.get('cookie')).toBe(viewer.cookie)
    expect(headers.get('x-forwarded-for')).toBe(viewer.forwardedFor)
  })

  it('sends the game read anonymously, with no cookie', async () => {
    const fetchMock = stubReads(jsonResponse(lobbySquadResponse))

    await readSquadDetails(viewerSquadSource(viewer), lobbySquad.code)

    expect(new Headers(sentInit(fetchMock, 1).headers).has('cookie')).toBe(false)
  })

  it('never caches either read', async () => {
    const fetchMock = stubReads(jsonResponse(lobbySquadResponse))

    await readSquadDetails(viewerSquadSource(viewer), lobbySquad.code)

    expect(sentInit(fetchMock, 0).cache).toBe('no-store')
    expect(sentInit(fetchMock, 1).cache).toBe('no-store')
    expect(sentInit(fetchMock, 0).next).toBeUndefined()
    expect(sentInit(fetchMock, 1).next).toBeUndefined()
  })

  it('reads a Squad the viewer cannot see as missing, not as a failure', async () => {
    stubReads(jsonResponse({ error: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404))

    await expect(readSquadDetails(viewerSquadSource(viewer), lobbySquad.code)).resolves.toBeNull()
  })

  it('starts the read in the query client, so the Squad is in the cache once it settles', async () => {
    stubReads(jsonResponse(lobbySquadResponse))
    const queryClient = new QueryClient()

    prefetchLobby(queryClient, viewer, lobbySquad.code)

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(squadQueryKey(lobbySquad.code))).toEqual({
        response: lobbySquadResponse,
        game: gameLol,
      })
    )
  })

  it('logs a failed read and leaves the cache empty, so the browser reads the Squad again', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubReads(jsonResponse({ error: 'INTERNAL', message: 'boom' }, 500))
    const queryClient = new QueryClient()

    prefetchLobby(queryClient, viewer, lobbySquad.code)

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(queryClient.getQueryData(squadQueryKey(lobbySquad.code))).toBeUndefined()
  })
})
