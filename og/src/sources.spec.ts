import { afterEach, describe, expect, it, vi } from 'vitest'
import { igdbCover, readCover, CoverReadError } from './cover'
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

describe('apiGameSource', () => {
  it("reads the game's public data with the edge secret", async () => {
    const fetchMock = vi.fn(async () => Response.json({ game: GAME }))
    vi.stubGlobal('fetch', fetchMock)

    const game = await apiGameSource('https://api.squadzr.app/', TOKEN)(GAME.id)

    expect(game).toMatchObject({ name: 'Valorant', maxPlayers: 5 })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://api.squadzr.app/api/games/${GAME.id}`)
    expect(new Headers(init.headers).get('x-squadzr-edge-auth')).toBe(TOKEN)
    expect(new Headers(init.headers).has('cookie')).toBe(false)
  })

  it('reads a missing game as null', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: 'GAME_NOT_FOUND' }, { status: 404 }))

    await expect(apiGameSource('https://api.squadzr.app', TOKEN)(GAME.id)).resolves.toBeNull()
  })

  it.each([
    ['a failed read', () => Response.json({ error: 'INTERNAL' }, { status: 500 })],
    ['a body that breaks the contract', () => Response.json({ game: { name: 'x' } })],
  ])('throws on %s', async (_label, answer) => {
    vi.stubGlobal('fetch', async () => answer())

    await expect(apiGameSource('https://api.squadzr.app', TOKEN)(GAME.id)).rejects.toBeInstanceOf(
      GameReadError
    )
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

  it('keeps any other address as it is', () => {
    expect(igdbCover('https://example.com/cover.webp', 'micro')).toBe(
      'https://example.com/cover.webp'
    )
  })
})

describe('readCover', () => {
  it('reads the box art and the backdrop as data URIs', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const bytes = url.includes('/t_micro/') ? [4, 5, 6] : [1, 2, 3]
      return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'image/jpeg' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(readCover(GAME.coverUrl)).resolves.toEqual({
      tile: 'data:image/jpeg;base64,AQID',
      backdrop: 'data:image/jpeg;base64,BAUG',
    })
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
      'https://images.igdb.com/igdb/image/upload/t_cover_big/cocqbp.jpg',
      'https://images.igdb.com/igdb/image/upload/t_micro/cocqbp.jpg',
    ])
  })

  it('throws when the cover cannot be read', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }))

    await expect(readCover(GAME.coverUrl)).rejects.toBeInstanceOf(CoverReadError)
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
