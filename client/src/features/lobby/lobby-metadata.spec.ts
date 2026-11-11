import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_INTERNAL_URL } from '@/env.server'
import { DEFAULT_PREVIEW, SITE_TITLE } from '@/lib/site-metadata'
import { lobbySquad } from '@/test/fixtures'
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

/** Answers the Squad read by path and records every call. */
function stubRead(answer: Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith(`${API_INTERNAL_URL}/api/rooms/`)) return answer.clone()
    throw new Error(`Unexpected read: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentInit(fetchMock: ReturnType<typeof stubRead>, index: number): RecordedInit {
  return fetchMock.mock.calls[index]?.[1] as RecordedInit
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** The landing's preview, never Squad details. */
const GENERIC = { title: { absolute: SITE_TITLE }, ...DEFAULT_PREVIEW }

describe('lobbyMetadata', () => {
  it('gives an Open Squad the full invite preview: its title, its copy and its slots image', async () => {
    stubRead(jsonResponse({ room: publicSquad }))

    const metadata = await lobbyMetadata(lobbySquad.code)

    const image = {
      url: `/og/squad/${lobbySquad.game.id}/1-3/en.jpg`,
      width: 1200,
      height: 630,
      alt: 'Open League of Legends squad: 1 of 3 slots filled',
      type: 'image/jpeg',
    }
    expect(metadata.title).toBe('Squad ready check · League of Legends')
    expect(metadata.description).toBe('2 of 3 spots left · English · #squad')
    expect(metadata.openGraph).toEqual({
      siteName: 'Squadzr',
      type: 'website',
      url: `/squads/${lobbySquad.code}`,
      title: 'Squad ready check · League of Legends',
      description: '2 of 3 spots left · English · #squad',
      images: [image],
    })
    expect(metadata.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Squad ready check · League of Legends',
      description: '2 of 3 spots left · English · #squad',
      images: [image],
    })
  })

  it("writes a Portuguese Squad's preview in Portuguese, whatever the visitor's locale", async () => {
    stubRead(
      jsonResponse({
        room: { ...publicSquad, language: 'pt-br', maxPlayers: 5, memberCount: 3, platform: 'pc' },
      })
    )

    const metadata = await lobbyMetadata(lobbySquad.code)

    expect(metadata.description).toBe('Faltam 2 de 5 · Português · PC · #squad')
    expect(metadata.openGraph).toMatchObject({
      images: [
        {
          url: `/og/squad/${lobbySquad.game.id}/3-5/pt-br.jpg`,
          alt: 'Squad aberto de League of Legends: 3 de 5 vagas preenchidas',
        },
      ],
    })
  })

  it.each([
    ['en', 4, '1 of 5 spots left'],
    ['pt-br', 4, 'Falta 1 de 5'],
    ['en', 5, 'Full squad'],
    ['pt-br', 5, 'Squad completo'],
  ] as const)(
    'counts the open spots of a %s Squad with %i of 5 members',
    async (language, count, copy) => {
      stubRead(
        jsonResponse({ room: { ...publicSquad, language, maxPlayers: 5, memberCount: count } })
      )

      const metadata = await lobbyMetadata(lobbySquad.code)

      expect(metadata.description).toBe(
        `${copy} · ${language === 'en' ? 'English' : 'Português'} · #squad`
      )
    }
  )

  it('points at the next image when the Squad gains a member', async () => {
    stubRead(jsonResponse({ room: { ...publicSquad, maxPlayers: 5, memberCount: 2 } }))
    const before = await lobbyMetadata(lobbySquad.code)
    stubRead(jsonResponse({ room: { ...publicSquad, maxPlayers: 5, memberCount: 3 } }))
    const after = await lobbyMetadata(lobbySquad.code)

    expect(before.openGraph).toMatchObject({
      images: [{ url: `/og/squad/${lobbySquad.game.id}/2-5/en.jpg` }],
    })
    expect(after.openGraph).toMatchObject({
      images: [{ url: `/og/squad/${lobbySquad.game.id}/3-5/en.jpg` }],
    })
  })

  it('names the game from the Squad response, not from a separate catalog read', async () => {
    const game = { ...lobbySquad.game, name: 'Arc Raiders' }
    const fetchMock = stubRead(jsonResponse({ room: { ...publicSquad, game } }))

    const metadata = await lobbyMetadata(lobbySquad.code)

    expect(metadata.title).toBe('Squad ready check · Arc Raiders')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('leaves the tags out of the description of a Squad without tags', async () => {
    stubRead(jsonResponse({ room: { ...publicSquad, tags: [] } }))

    const metadata = await lobbyMetadata(lobbySquad.code)

    expect(metadata.description).toBe('2 of 3 spots left · English')
  })

  it('names the platform after the language when the Squad has one', async () => {
    stubRead(jsonResponse({ room: { ...publicSquad, platform: 'ps5' } }))

    const metadata = await lobbyMetadata(lobbySquad.code)

    expect(metadata.description).toBe('2 of 3 spots left · English · PS5 · #squad')
  })

  it('reads the Squad anonymously and never from a cache', async () => {
    const fetchMock = stubRead(jsonResponse({ room: publicSquad }))

    await lobbyMetadata(lobbySquad.code)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new Headers(sentInit(fetchMock, 0).headers).has('cookie')).toBe(false)
    expect(sentInit(fetchMock, 0).cache).toBe('no-store')
    expect(sentInit(fetchMock, 0).next).toBeUndefined()
  })

  it.each([
    ['a Ready Squad', notFound()],
    ['an expired Squad', notFound()],
    ['a missing Squad', notFound()],
  ])('gives %s the generic metadata', async (_label, squad) => {
    const fetchMock = stubRead(squad)

    await expect(lobbyMetadata(lobbySquad.code)).resolves.toEqual(GENERIC)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives the generic metadata when the Squad read fails, and logs the failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubRead(jsonResponse({ error: 'INTERNAL', message: 'boom' }, 500))

    await expect(lobbyMetadata(lobbySquad.code)).resolves.toEqual(GENERIC)
    expect(consoleError).toHaveBeenCalled()
  })

  it('gives the generic metadata for a code the contract rejects, without reading anything', async () => {
    const fetchMock = stubRead(jsonResponse({ room: publicSquad }))

    await expect(lobbyMetadata('abc')).resolves.toEqual(GENERIC)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
