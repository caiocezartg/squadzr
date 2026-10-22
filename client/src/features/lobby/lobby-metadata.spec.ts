import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { gameLol, lobbySquad } from '@/test/fixtures'
import { lobbyMetadata } from './lobby-metadata'

type RecordedInit = RequestInit & { next?: { revalidate?: number } }

/** The Squad as a visitor reads it: the public projection, with no Discord invite. */
const { discordLink: _discordLink, ...publicSquad } = lobbySquad

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const notFound = () => jsonResponse({ error: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404)

/** Answers the Squad read and the game read by path, and records every call. */
function stubReads(answers: { squad: Response; game?: Response }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith(`${API_INTERNAL_URL}/api/rooms/`)) return answers.squad.clone()
    if (url.startsWith(`${API_INTERNAL_URL}/api/games/`)) {
      return (answers.game ?? jsonResponse({ game: gameLol })).clone()
    }
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

const GENERIC = { title: { absolute: 'Squadzr' } }

describe('lobbyMetadata', () => {
  it('gives an Open Squad the full invite preview: name and game, size, language, tags and cover', async () => {
    stubReads({ squad: jsonResponse({ room: publicSquad }) })

    const metadata = await lobbyMetadata(lobbySquad.code)

    expect(metadata.title).toBe('Squad ready check · League of Legends')
    expect(metadata.description).toBe('Up to 3 players · EN-US · #squad')
    expect(metadata.openGraph).toEqual({
      title: 'Squad ready check · League of Legends',
      description: 'Up to 3 players · EN-US · #squad',
      images: [gameLol.coverUrl],
    })
    expect(metadata.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Squad ready check · League of Legends',
      description: 'Up to 3 players · EN-US · #squad',
      images: [gameLol.coverUrl],
    })
  })

  it('leaves the tags out of the description of a Squad without tags', async () => {
    stubReads({ squad: jsonResponse({ room: { ...publicSquad, tags: [] } }) })

    const metadata = await lobbyMetadata(lobbySquad.code)

    expect(metadata.description).toBe('Up to 3 players · EN-US')
  })

  it('reads the Squad and its game anonymously and never from a cache', async () => {
    const fetchMock = stubReads({ squad: jsonResponse({ room: publicSquad }) })

    await lobbyMetadata(lobbySquad.code)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const index of [0, 1]) {
      expect(new Headers(sentInit(fetchMock, index).headers).has('cookie')).toBe(false)
      expect(sentInit(fetchMock, index).cache).toBe('no-store')
      expect(sentInit(fetchMock, index).next).toBeUndefined()
    }
  })

  it.each([
    ['a Ready Squad', notFound()],
    ['an expired Squad', notFound()],
    ['a missing Squad', notFound()],
  ])('gives %s the generic metadata, and reads no game', async (_label, squad) => {
    const fetchMock = stubReads({ squad })

    await expect(lobbyMetadata(lobbySquad.code)).resolves.toEqual(GENERIC)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives the generic metadata when the game lookup fails', async () => {
    stubReads({ squad: jsonResponse({ room: publicSquad }), game: notFound() })

    await expect(lobbyMetadata(lobbySquad.code)).resolves.toEqual(GENERIC)
  })

  it('gives the generic metadata when the Squad read fails, and logs the failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubReads({ squad: jsonResponse({ error: 'INTERNAL', message: 'boom' }, 500) })

    await expect(lobbyMetadata(lobbySquad.code)).resolves.toEqual(GENERIC)
    expect(consoleError).toHaveBeenCalled()
  })

  it('gives the generic metadata for a code the contract rejects, without reading anything', async () => {
    const fetchMock = stubReads({ squad: jsonResponse({ room: publicSquad }) })

    await expect(lobbyMetadata('abc')).resolves.toEqual(GENERIC)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
