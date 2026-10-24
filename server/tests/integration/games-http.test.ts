import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gameResponseSchema, gamesResponseSchema } from '@squadzr/schemas'
import { get, insertGame } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-63: the games routes answer through use cases; an unknown game is 404 GAME_NOT_FOUND.
// CCC-93: GET /api/games searches Listed Games, ranks prefix matches first and
// escapes the LIKE wildcards; GET /api/games/:id still answers for a delisted Game.

let server: TestServer

beforeEach(async () => {
  server = await buildTestServer()
})

afterEach(async () => {
  await server.close()
})

async function searchGames(query: string): Promise<string[]> {
  const response = await get(server, `/api/games${query}`)
  expect(response.statusCode, response.body).toBe(200)
  return gamesResponseSchema.parse(response.json()).games.map((game) => game.name)
}

describe('GET /api/games', () => {
  it('lists every Listed Game to anonymous visitors', async () => {
    const lol = await insertGame(server)
    const cs2 = await insertGame(server)

    const response = await get(server, '/api/games')

    expect(response.statusCode).toBe(200)
    const { games } = gamesResponseSchema.parse(response.json())
    expect(games).toHaveLength(2)
    expect(games).toEqual(expect.arrayContaining([lol, cs2]))
  })

  it('answers with genres and the cover thumbnail of each game', async () => {
    const game = await insertGame(server, {
      genres: [{ slug: 'moba', name: 'MOBA' }],
      thumbnailUrl: 'https://cdn.squadzr.test/lol-thumb.webp',
    })

    const response = await get(server, '/api/games')

    expect(gamesResponseSchema.parse(response.json()).games).toEqual([game])
    expect(game.genres).toEqual([{ slug: 'moba', name: 'MOBA' }])
    expect(game.coverThumbUrl).toBe('https://cdn.squadzr.test/lol-thumb.webp')
  })

  it('returns the most popular Listed Games without a search', async () => {
    await insertGame(server, { name: 'Quiet Game', popularity: 1 })
    await insertGame(server, { name: 'Popular Game', popularity: 100 })
    await insertGame(server, { name: 'Delisted Popular Game', popularity: 1_000, listed: false })

    expect(await searchGames('')).toEqual(['Popular Game', 'Quiet Game'])
  })

  it('matches a case-insensitive name contains', async () => {
    await insertGame(server, { name: 'League of Legends' })
    await insertGame(server, { name: 'Counter-Strike 2' })

    expect(await searchGames('?search=LEAGUE')).toEqual(['League of Legends'])
    expect(await searchGames('?search=legend')).toEqual(['League of Legends'])
    expect(await searchGames('?search=strike')).toEqual(['Counter-Strike 2'])
  })

  it('treats a blank search as no search', async () => {
    await insertGame(server, { name: 'Popular Game', popularity: 10 })
    await insertGame(server, { name: 'Quiet Game', popularity: 1 })

    expect(await searchGames('?search=%20%20%20')).toEqual(['Popular Game', 'Quiet Game'])
    expect(await searchGames('?search=')).toEqual(['Popular Game', 'Quiet Game'])
  })

  it('ranks name-prefix matches first, then popularity, name and id', async () => {
    await insertGame(server, { name: 'Pro League', popularity: 100 })
    await insertGame(server, { name: 'League of Legends', popularity: 10 })
    await insertGame(server, { name: 'League', popularity: 1 })
    await insertGame(server, { name: 'Arena League', popularity: 5 })

    expect(await searchGames('?search=league')).toEqual([
      'League of Legends',
      'League',
      'Pro League',
      'Arena League',
    ])
  })

  it('orders equally popular contains matches by name', async () => {
    await insertGame(server, { name: 'Zeta Legends', popularity: 7 })
    await insertGame(server, { name: 'Alpha Legends', popularity: 7 })

    expect(await searchGames('?search=legends')).toEqual(['Alpha Legends', 'Zeta Legends'])
  })

  it('matches %, _ and the escape character literally', async () => {
    await insertGame(server, { name: '100% Cup' })
    await insertGame(server, { name: '100 Cups' })
    await insertGame(server, { name: 'half_life' })
    await insertGame(server, { name: 'halfXlife' })
    await insertGame(server, { name: 'back\\slash' })
    await insertGame(server, { name: 'backslash' })

    expect(await searchGames('?search=100%25')).toEqual(['100% Cup'])
    expect(await searchGames('?search=half_life')).toEqual(['half_life'])
    expect(await searchGames('?search=back%5Cslash')).toEqual(['back\\slash'])
    // A bare wildcard must not match every game.
    expect(await searchGames('?search=%25')).toEqual(['100% Cup'])
    expect(await searchGames('?search=_')).toEqual(['half_life'])
  })

  it('returns only Listed Games', async () => {
    await insertGame(server, { name: 'Legends of the Hidden Temple' })
    await insertGame(server, { name: 'Hidden Legends', listed: false })

    expect(await searchGames('?search=legends')).toEqual(['Legends of the Hidden Temple'])
  })

  it('returns at most the limit, defaulting to twenty', async () => {
    for (let index = 0; index < 22; index += 1) {
      await insertGame(server, { name: `Game ${String(index).padStart(2, '0')}` })
    }

    const all = await searchGames('')
    expect(all).toHaveLength(20)

    const one = await searchGames('?limit=1')
    expect(one).toHaveLength(1)

    const fifty = await searchGames('?limit=50')
    expect(fifty).toHaveLength(22)
  })

  it.each(['limit=0', 'limit=51', 'limit=1.5', 'limit=many'])(
    'rejects the invalid %s with 400 VALIDATION_ERROR',
    async (query) => {
      const response = await get(server, `/api/games?${query}`)

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({
        error: 'VALIDATION_ERROR',
        message: expect.any(String),
      })
    }
  )
})

describe('GET /api/games/:id', () => {
  it('returns the requested game to anonymous visitors', async () => {
    const game = await insertGame(server)

    const response = await get(server, `/api/games/${game.id}`)

    expect(response.statusCode).toBe(200)
    expect(gameResponseSchema.parse(response.json())).toEqual({ game })
  })

  it('still answers for a delisted Game', async () => {
    const game = await insertGame(server, { listed: false })

    const response = await get(server, `/api/games/${game.id}`)

    expect(response.statusCode).toBe(200)
    expect(gameResponseSchema.parse(response.json())).toEqual({ game })
  })

  it('answers 404 GAME_NOT_FOUND in the standard shape for an unknown game', async () => {
    const id = randomUUID()

    const response = await get(server, `/api/games/${id}`)

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: 'GAME_NOT_FOUND',
      message: `Game "${id}" not found`,
    })
  })
})
