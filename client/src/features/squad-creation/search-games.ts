import { GAME_SEARCH_MAX_LENGTH, gamesResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import type { Game } from '@/types'

/** How many matching games the create dialog lists. */
const GAME_SEARCH_LIMIT = 20

/**
 * The game search behind the create dialog. An empty term asks for the
 * suggestions (Featured Games first, then by popularity), which is what the
 * dialog shows before the player types.
 * The optional signal lets a newer term cancel the request it superseded.
 */
export function searchGames(term: string, signal?: AbortSignal): Promise<Game[]> {
  const query = new URLSearchParams({ limit: String(GAME_SEARCH_LIMIT) })
  // The field limits the term already; this keeps a longer one (a script, a test) from becoming a 400.
  const search = term.trim().slice(0, GAME_SEARCH_MAX_LENGTH)
  if (search !== '') query.set('search', search)

  return api
    .get(`/api/games?${query.toString()}`, gamesResponseSchema, signal)
    .then(({ games }) => games)
}
