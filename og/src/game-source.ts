import { EDGE_AUTH_HEADER, gameResponseSchema, type GameDto } from '@squadzr/schemas'

/** What the image needs from a game: public catalog data, never a session. */
export type PreviewGame = Pick<GameDto, 'id' | 'name' | 'coverUrl' | 'maxPlayers'>

/** Reads one game, or `null` when the catalog has no game with that id. */
export type GameSource = (gameId: string) => Promise<PreviewGame | null>

/** A read that did not answer with a game or a 404: the image cannot be rendered right now. */
export class GameReadError extends Error {
  constructor(readonly status: number) {
    super(`Game read failed with status ${status}`)
    this.name = 'GameReadError'
  }
}

/**
 * Reads a game from the API's public route. The edge secret goes out with the call, as it does from
 * `squadzr-web`, so the API's origin lock lets the Worker in.
 */
export function apiGameSource(apiUrl: string, edgeAuthToken: string | undefined): GameSource {
  const base = apiUrl.replace(/\/+$/, '')

  return async (gameId) => {
    const headers = new Headers({ accept: 'application/json' })
    if (edgeAuthToken) headers.set(EDGE_AUTH_HEADER, edgeAuthToken)

    const response = await fetch(`${base}/api/games/${gameId}`, { headers })
    if (response.status === 404) return null
    if (!response.ok) throw new GameReadError(response.status)

    const parsed = gameResponseSchema.safeParse(await response.json().catch(() => undefined))
    if (!parsed.success) throw new GameReadError(response.status)
    return parsed.data.game
  }
}
