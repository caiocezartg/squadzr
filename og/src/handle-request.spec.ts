import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameReadError, type PreviewGame } from './game-source'
import { handleImageRequest, type ImageDeps } from './handle-request'
import type { SquadImageInput } from './squad-image'

const VALORANT: PreviewGame = {
  id: 'c6b3f931-0493-4091-9c3b-b44613fb3da4',
  name: 'Valorant',
  coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocqbp.jpg',
}

const COVER = { tile: 'data:image/jpeg;base64,AAAA', backdrop: 'data:image/jpeg;base64,BBBB' }

const imageUrl = (path: string) => `https://squadzr.app/og/squad/v1/${path}`

function deps(game: PreviewGame | null = VALORANT) {
  const rendered: SquadImageInput[] = []
  const source = {
    rendered,
    readGame: vi.fn(async (_gameId: string) => game),
    readCover: vi.fn(async (_coverUrl: string) => COVER),
    render: vi.fn(async (input: SquadImageInput) => {
      rendered.push(input)
      return new Response('jpeg', { headers: { 'content-type': 'image/jpeg' } })
    }),
  }
  return source satisfies ImageDeps & { rendered: SquadImageInput[] }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('handleImageRequest', () => {
  it('renders the image of a valid key, with the game read from the catalog', async () => {
    const source = deps()

    const response = await handleImageRequest(
      new Request(imageUrl(`${VALORANT.id}/3-5/pt-br.jpg`)),
      source
    )

    expect(response.status).toBe(200)
    expect(source.readGame).toHaveBeenCalledWith(VALORANT.id)
    expect(source.readCover).toHaveBeenCalledWith(VALORANT.coverUrl)
    expect(source.rendered).toEqual([
      {
        previewKey: { gameId: VALORANT.id, filled: 3, total: 5, language: 'pt-br' },
        gameName: 'Valorant',
        cover: COVER,
      },
    ])
  })

  it("renders a Squad with more slots than its game's player limit", async () => {
    // Valorant's limit is 5; a Squad can be bigger (the limit can drop after the Squad is created).
    const source = deps()

    const response = await handleImageRequest(
      new Request(imageUrl(`${VALORANT.id}/3-12/en.jpg`)),
      source
    )

    expect(response.status).toBe(200)
    expect(source.rendered[0]?.previewKey).toMatchObject({ filled: 3, total: 12 })
  })

  it('accepts a HEAD request', async () => {
    const response = await handleImageRequest(
      new Request(imageUrl(`${VALORANT.id}/1-5/en.jpg`), { method: 'HEAD' }),
      deps()
    )

    expect(response.status).toBe(200)
  })

  it.each([
    ['a path that is not a key', 'https://squadzr.app/og/squad/v1/valorant.jpg'],
    ['a key without the design version', `https://squadzr.app/og/squad/${VALORANT.id}/2-5/en.jpg`],
    ['a key with more filled slots than the total', imageUrl(`${VALORANT.id}/6-5/en.jpg`)],
    ['a key over 40 slots', imageUrl(`${VALORANT.id}/2-41/en.jpg`)],
    ['a key with an unknown language', imageUrl(`${VALORANT.id}/2-5/es.jpg`)],
    ['a key with a query string', `${imageUrl(`${VALORANT.id}/2-5/en.jpg`)}?v=2`],
    ['a key with a bare question mark', `${imageUrl(`${VALORANT.id}/2-5/en.jpg`)}?`],
  ])('answers a cached 404 to %s without reading anything', async (_label, url) => {
    const source = deps()

    const response = await handleImageRequest(new Request(url), source)

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(source.readGame).not.toHaveBeenCalled()
    expect(source.readCover).not.toHaveBeenCalled()
  })

  it('answers 404 to a game the catalog does not have', async () => {
    const source = deps(null)

    const response = await handleImageRequest(
      new Request(imageUrl(`${VALORANT.id}/2-5/en.jpg`)),
      source
    )

    expect(response.status).toBe(404)
    expect(source.rendered).toEqual([])
  })

  it.each([
    ['another host', 'https://example.com/igdb/image/upload/t_cover_big/cocqbp.jpg'],
    ['plain HTTP', 'http://images.igdb.com/igdb/image/upload/t_cover_big/cocqbp.jpg'],
    ['another IGDB path', 'https://images.igdb.com/other/t_cover_big/cocqbp.jpg'],
  ])('never fetches a cover on %s, and answers a cached 404', async (_label, coverUrl) => {
    const source = deps({ ...VALORANT, coverUrl })

    const response = await handleImageRequest(
      new Request(imageUrl(`${VALORANT.id}/2-5/en.jpg`)),
      source
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(source.readCover).not.toHaveBeenCalled()
    expect(source.rendered).toEqual([])
  })

  it('answers an uncached 502 when the catalog read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const source = deps()
    source.readGame.mockRejectedValueOnce(new GameReadError('status 500'))

    const response = await handleImageRequest(
      new Request(imageUrl(`${VALORANT.id}/2-5/en.jpg`)),
      source
    )

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('refuses any method but GET and HEAD', async () => {
    const response = await handleImageRequest(
      new Request(imageUrl(`${VALORANT.id}/2-5/en.jpg`), { method: 'POST' }),
      deps()
    )

    expect(response.status).toBe(405)
  })
})
