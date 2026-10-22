import 'server-only'
import { gamesResponseSchema, type GamesResponse } from '@squadzr/schemas'
import { ApiContractError } from '@/lib/api-contract'
import type { Game } from '@/types'
import { serverApi } from './api'

/** How many games the popular games grid shows. */
const POPULAR_GAMES_COUNT = 8
// The list is small and public, so a slow Fastify gets the same short wait as the session read.
const GAMES_TIMEOUT_MS = 2_000

/**
 * The game list as the server reads it. The list is public, so the call sends no cookie, and Next
 * shares its response between visitors and revalidates it every five minutes. A failed read throws.
 */
export function fetchGames(): Promise<GamesResponse> {
  return serverApi.get(
    '/api/games',
    gamesResponseSchema,
    { credentials: 'anonymous', caching: 'revalidated' },
    { timeoutMs: GAMES_TIMEOUT_MS }
  )
}

/**
 * The games the landing lists. A failed read renders the landing without games, as the browser did;
 * a 2xx whose body breaks the contract throws.
 */
export async function loadGames(): Promise<Game[]> {
  try {
    const { games } = await fetchGames()
    return games
  } catch (error) {
    if (error instanceof ApiContractError && error.status < 300) throw error

    console.error('Games read failed; the landing renders without games:', error)
    return []
  }
}

/**
 * The games the popular games grid shows: the list in random order, cut to eight. The order is drawn
 * here, on the server, so the server HTML carries the order the page rendered with.
 */
export function pickPopularGames(
  games: readonly Game[],
  random: () => number = Math.random
): Game[] {
  return shuffle(games, random).slice(0, POPULAR_GAMES_COUNT)
}

/** Fisher-Yates on a copy, so the caller's list keeps its order. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const temp = result[i] as T
    result[i] = result[j] as T
    result[j] = temp
  }
  return result
}
