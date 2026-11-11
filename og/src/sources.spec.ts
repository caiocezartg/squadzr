import { afterEach, describe, expect, it, vi } from 'vitest'
import { COVER_MAX_BYTES, CoverReadError, igdbCover, isIgdbCover, readCover } from './cover'
import { parseEnv } from './env'
import { apiGameSource, GameReadError } from './game-source'

const GAME = {
  id: 'c6b3f931-0493-4091-9c3b-b44613fb3da4',
  name: 'Valorant',
  slug: 'valorant',
  genres: [],
  platforms: ['pc'],
  coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocqbp.jpg',
  coverThumbUrl: 'https://images.igdb.com/igdb/image/upload/t_thumb/cocqbp.jpg',
  minPlayers: 2,
  maxPlayers: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const TOKEN = 'a'.repeat(32)

afterEach(() => {
  vi.unstubAllGlobals()
})

const COVER_URL = 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocqbp.jpg'

function jpeg(bytes: number[], headers: Record<string, string> = {}) {
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': 'image/jpeg', ...headers },
  })
}

describe('apiGameSource', () => {
  it("reads the game's public data with the edge secret and a timeout", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ game: GAME })
    )
    vi.stubGlobal('fetch', fetchMock)

    const game = await apiGameSource('https://api.squadzr.app/', TOKEN)(GAME.id)

    expect(game).toMatchObject({ name: 'Valorant', coverUrl: GAME.coverUrl })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.squadzr.app/api/games/${GAME.id}`)
    expect(new Headers(init.headers).get('x-squadzr-edge-auth')).toBe(TOKEN)
    expect(new Headers(init.headers).has('cookie')).toBe(false)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('reads a missing game as null', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: 'GAME_NOT_FOUND' }, { status: 404 }))

    await expect(apiGameSource('https://api.squadzr.app', TOKEN)(GAME.id)).resolves.toBeNull()
  })

  it.each([
    ['a failed read', () => Response.json({ error: 'INTERNAL' }, { status: 500 }), 'status 500'],
    [
      'a body that breaks the contract',
      () => Response.json({ game: { name: 'x' } }),
      'invalid body',
    ],
    ['a body that is not JSON', () => new Response('<html>'), 'invalid body'],
  ])('throws on %s, naming the reason', async (_label, answer, reason) => {
    vi.stubGlobal('fetch', async () => answer())

    const read = apiGameSource('https://api.squadzr.app', TOKEN)(GAME.id)

    await expect(read).rejects.toBeInstanceOf(GameReadError)
    await expect(read).rejects.toMatchObject({ reason })
  })
})

describe('igdbCover', () => {
  it('asks IGDB for a cover in the given size, as a JPEG', () => {
    const webp = 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co999.webp'

    expect(igdbCover(webp, 'cover_big')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_cover_big/co999.jpg'
    )
    expect(igdbCover(webp, 'micro')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_micro/co999.jpg'
    )
  })

  it.each([
    ['another host', 'https://example.com/igdb/image/upload/t_cover_big/co999.jpg'],
    [
      'a look-alike host',
      'https://images.igdb.com.evil.test/igdb/image/upload/t_cover_big/co9.jpg',
    ],
    ['plain HTTP', 'http://images.igdb.com/igdb/image/upload/t_cover_big/co999.jpg'],
    ['another path', 'https://images.igdb.com/igdb/other/t_cover_big/co999.jpg'],
  ])('refuses %s', (_label, url) => {
    expect(isIgdbCover(url)).toBe(false)
    expect(igdbCover(url, 'micro')).toBeNull()
  })
})

describe('readCover', () => {
  it('reads the box art and the backdrop from IGDB, following no redirect, with a timeout', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
      jpeg(url.includes('/t_micro/') ? [4, 5, 6] : [1, 2, 3])
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(readCover(COVER_URL)).resolves.toEqual({
      tile: 'data:image/jpeg;base64,AQID',
      backdrop: 'data:image/jpeg;base64,BAUG',
    })
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
      'https://images.igdb.com/igdb/image/upload/t_cover_big/cocqbp.jpg',
      'https://images.igdb.com/igdb/image/upload/t_micro/cocqbp.jpg',
    ])
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.redirect).toBe('manual')
      expect(init?.signal).toBeInstanceOf(AbortSignal)
    }
  })

  it('never fetches a cover that is not on IGDB', async () => {
    const fetchMock = vi.fn(async () => jpeg([1]))
    vi.stubGlobal('fetch', fetchMock)

    await expect(readCover('https://example.com/cover.jpg')).rejects.toBeInstanceOf(CoverReadError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['a failed read', () => new Response(null, { status: 404 })],
    [
      'a redirect',
      () => new Response(null, { status: 302, headers: { location: 'https://example.com/x.jpg' } }),
    ],
    [
      'a type that is not an image',
      () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    ],
    [
      'a WebP',
      () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/webp' } }),
    ],
    [
      'a declared size over the cap',
      () => jpeg([1], { 'content-length': String(COVER_MAX_BYTES + 1) }),
    ],
    ['a body over the cap', () => jpeg(Array.from({ length: COVER_MAX_BYTES + 1 }, () => 0))],
  ])('throws on %s', async (_label, answer) => {
    vi.stubGlobal('fetch', async () => answer())

    await expect(readCover(COVER_URL)).rejects.toBeInstanceOf(CoverReadError)
  })

  it('accepts a PNG', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
    )

    await expect(readCover(COVER_URL)).resolves.toMatchObject({
      tile: 'data:image/png;base64,AQID',
    })
  })
})

describe('parseEnv', () => {
  it('reads the API URL and the edge secret', () => {
    expect(parseEnv({ API_URL: 'https://api.squadzr.app', EDGE_AUTH_TOKEN: TOKEN })).toEqual({
      API_URL: 'https://api.squadzr.app',
      EDGE_AUTH_TOKEN: TOKEN,
    })
  })

  it('reads an empty secret as unset', () => {
    expect(parseEnv({ API_URL: 'https://api.squadzr.app', EDGE_AUTH_TOKEN: '' })).toEqual({
      API_URL: 'https://api.squadzr.app',
    })
  })

  it('names a bad binding without its value', () => {
    expect(() =>
      parseEnv({ API_URL: 'https://api.squadzr.app', EDGE_AUTH_TOKEN: 'short' })
    ).toThrow(/^Invalid Worker bindings: EDGE_AUTH_TOKEN$/)
  })
})
