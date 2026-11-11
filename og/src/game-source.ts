import { EDGE_AUTH_HEADER, gameResponseSchema, type GameDto } from '@squadzr/schemas'

/** What the image needs from a game: public catalog data, never a session. */
export type PreviewGame = Pick<GameDto, 'id' | 'name' | 'coverUrl'>

/** Reads one game, or `null` when the catalog has no game with that id. */
export type GameSource = (gameId: string) => Promise<PreviewGame | null>

/**
 * A read that did not answer with a game or a 404: the image cannot be rendered right now. The reason is
 * the failed status, or `invalid body` when a 200 carried no game the contract accepts.
 */
export class GameReadError extends Error {
  constructor(readonly reason: string) {
    super(`Game read failed: ${reason}`)
    this.name = 'GameReadError'
  }
}

/** How long a game read may take before the image counts as unavailable. */
export const GAME_READ_TIMEOUT_MS = 5000

/**
 * Reads a game from the API's public route. The edge secret goes out with the call, as it does from
 * `squadzr-web`, so the API's origin lock lets the Worker in: the zone's Transform Rule does not stamp a
 * subrequest made by a Worker of the same zone.
 */
export function apiGameSource(apiUrl: string, edgeAuthToken: string | undefined): GameSource {
  const base = apiUrl.replace(/\/+$/, '')

  return async (gameId) => {
    const headers = new Headers({ accept: 'application/json' })
    if (edgeAuthToken) headers.set(EDGE_AUTH_HEADER, edgeAuthToken)

    const response = await fetch(`${base}/api/games/${gameId}`, {
      headers,
      signal: AbortSignal.timeout(GAME_READ_TIMEOUT_MS),
    })
    if (response.status === 404) return null
    if (!response.ok) throw new GameReadError(`status ${response.status}`)

    const parsed = gameResponseSchema.safeParse(await response.json().catch(() => undefined))
    if (!parsed.success) throw new GameReadError('invalid body')
    return parsed.data.game
  }
}
