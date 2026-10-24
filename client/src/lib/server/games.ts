import 'server-only'
import {
  gamesResponseSchema,
  popularGamesResponseSchema,
  type GamesResponse,
  type PopularGamesResponse,
} from '@squadzr/schemas'
import { ApiContractError } from '@/lib/api-contract'
import { serverApi } from './api'

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
 * The landing's popular games read: the total of Listed Games and the games with the most Open
 * Squads. Public and revalidated like the list, so every visitor shares one response.
 */
export function fetchPopularGames(): Promise<PopularGamesResponse> {
  return serverApi.get(
    '/api/games/popular',
    popularGamesResponseSchema,
    { credentials: 'anonymous', caching: 'revalidated' },
    { timeoutMs: GAMES_TIMEOUT_MS }
  )
}

/**
 * The games the landing shows. A failed read renders the landing without games, as the browser
 * did; a 2xx whose body breaks the contract throws.
 */
export async function loadPopularGames(): Promise<PopularGamesResponse> {
  try {
    return await fetchPopularGames()
  } catch (error) {
    if (error instanceof ApiContractError && error.status < 300) throw error

    console.error('Popular games read failed; the landing renders without games:', error)
    return { totalGames: 0, games: [] }
  }
}
