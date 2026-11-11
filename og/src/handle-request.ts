import { parseSquadPreviewPath, type SquadPreviewKey } from '@squadzr/schemas'
import type { CoverImages } from './cover'
import type { GameSource, PreviewGame } from './game-source'
import type { SquadImageInput } from './squad-image'

/** What answering a request needs: where games come from, how a cover is read and how a key is drawn. */
export interface ImageDeps {
  readonly readGame: GameSource
  readonly readCover: (coverUrl: string) => Promise<CoverImages>
  readonly render: (input: SquadImageInput) => Promise<Response>
}

/**
 * A key that names no image. Cached for five minutes only: a game the catalog imports later becomes
 * a valid key.
 */
function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}

/** A failure upstream: never cached, so the next request tries again. */
function unavailable(): Response {
  return new Response('Image unavailable', {
    status: 502,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** The game's own limit: a Squad never has more slots than its game allows. */
function fitsGame(key: SquadPreviewKey, game: PreviewGame): boolean {
  return key.total <= game.maxPlayers
}

/**
 * Answers one image request. Only the exact spelling of a key renders: any other path, a query string,
 * an unknown game or a slot count the game does not allow answers 404, so nobody can mint images.
 */
export async function handleImageRequest(request: Request, deps: ImageDeps): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
  }

  const url = new URL(request.url)
  const key = url.search === '' ? parseSquadPreviewPath(url.pathname) : null
  if (!key) return notFound()

  try {
    const game = await deps.readGame(key.gameId)
    if (!game || !fitsGame(key, game)) return notFound()

    const cover = await deps.readCover(game.coverUrl)
    return await deps.render({ previewKey: key, gameName: game.name, cover })
  } catch (error) {
    console.error('Squad preview image failed:', error)
    return unavailable()
  }
}
