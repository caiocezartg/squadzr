import { parseSquadPreviewPath } from '@squadzr/schemas'
import { isIgdbCover, type CoverImages } from './cover'
import type { GameSource } from './game-source'
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

/**
 * Answers one image request. Only the exact spelling of a key renders: any other path, a query string
 * (even a bare `?`), an unknown game or a game whose cover is not on IGDB answers 404, so nobody can mint
 * images or make the Worker fetch an address of their choosing. The slot counts are bound by the key
 * alone: a Squad can have more slots than its game's current player limit.
 */
export async function handleImageRequest(request: Request, deps: ImageDeps): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
  }

  const key = request.url.includes('?')
    ? null
    : parseSquadPreviewPath(new URL(request.url).pathname)
  if (!key) return notFound()

  try {
    const game = await deps.readGame(key.gameId)
    if (!game || !isIgdbCover(game.coverUrl)) return notFound()

    const cover = await deps.readCover(game.coverUrl)
    return await deps.render({ previewKey: key, gameName: game.name, cover })
  } catch (error) {
    console.error('Squad preview image failed:', error)
    return unavailable()
  }
}
