import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameReadError, type PreviewGame } from './game-source'
import { handleImageRequest, type ImageDeps } from './handle-request'
import type { SquadImageInput } from './squad-image'

const VALORANT: PreviewGame = {
  id: 'c6b3f931-0493-4091-9c3b-b44613fb3da4',
  name: 'Valorant',
  coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocqbp.jpg',
  maxPlayers: 5,
}

const COVER = { tile: 'data:image/jpeg;base64,AAAA', backdrop: 'data:image/jpeg;base64,BBBB' }

const imageUrl = (path: string) => `https://squadzr.app/og/squad/${path}`

function deps(game: PreviewGame | null = VALORANT): ImageDeps & {
  rendered: SquadImageInput[]
  readGame: ReturnType<typeof vi.fn>
} {
  const rendered: SquadImageInput[] = []
  return {
    rendered,
    readGame: vi.fn(async () => game),
    readCover: vi.fn(async () => COVER),
    render: vi.fn(async (input: SquadImageInput) => {
      rendered.push(input)
      return new Response('jpeg', {
        headers: {
          'content-type': 'image/jpeg',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    }),
  }
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
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(source.readGame).toHaveBeenCalledWith(VALORANT.id)
    expect(source.rendered).toEqual([
      {
        previewKey: { gameId: VALORANT.id, filled: 3, total: 5, language: 'pt-br' },
        gameName: 'Valorant',
        cover: COVER,
      },
    ])
  })

  it('accepts a HEAD request', async () => {
    const response = await handleImageRequest(
      new Request(imageUrl(`${VALORANT.id}/1-5/en.jpg`), { method: 'HEAD' }),
      deps()
    )

    expect(response.status).toBe(200)
  })

  it.each([
    ['a path that is not a key', imageUrl('valorant.jpg')],
    ['a key with more filled slots than the total', imageUrl(`${VALORANT.id}/6-5/en.jpg`)],
    ['a key with an unknown language', imageUrl(`${VALORANT.id}/2-5/es.jpg`)],
    ['a key with a query string', `${imageUrl(`${VALORANT.id}/2-5/en.jpg`)}?v=2`],
  ])('answers 404 to %s without reading the catalog', async (_label, url) => {
    const source = deps()

    const response = await handleImageRequest(new Request(url), source)

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(source.readGame).not.toHaveBeenCalled()
    expect(source.rendered).toEqual([])
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

  it("answers 404 to more slots than the game's player limit", async () => {
    const source = deps()

    const response = await handleImageRequest(
      new Request(imageUrl(`${VALORANT.id}/2-6/en.jpg`)),
      source
    )

    expect(response.status).toBe(404)
    expect(source.rendered).toEqual([])
  })

  it('answers an uncached 502 when the catalog read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const source = deps()
    source.readGame.mockRejectedValueOnce(new GameReadError(500))

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
