import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gameResponseSchema, gamesResponseSchema } from '@squadzr/schemas'
import { get, insertGame } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-63: the games routes answer through use cases; an unknown game is 404 GAME_NOT_FOUND.
// CCC-93: GET /api/games searches Listed Games; GET /api/games/:id still answers for a delisted Game.
// #100: the search ignores case, accents and punctuation, matches aliases and
// tolerates a typo; a term made only of punctuation lists the suggestions.

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

  it('answers with the platforms of each game, in display order, and [] when it has none', async () => {
    const multi = await insertGame(server, { platforms: ['pc', 'ps5', 'switch', 'mobile'] })
    const none = await insertGame(server)

    const response = await get(server, '/api/games')

    const { games } = gamesResponseSchema.parse(response.json())
    expect(games).toEqual(expect.arrayContaining([multi, none]))
    expect(multi.platforms).toEqual(['pc', 'ps5', 'switch', 'mobile'])
    expect(none.platforms).toEqual([])
  })

  it('returns the most popular Listed Games without a search', async () => {
    await insertGame(server, { name: 'Quiet Game', popularity: 1 })
    await insertGame(server, { name: 'Popular Game', popularity: 100 })
    await insertGame(server, { name: 'Delisted Popular Game', popularity: 1_000, listed: false })

    expect(await searchGames('')).toEqual(['Popular Game', 'Quiet Game'])
  })

  it('puts the Featured Games first without a search, then orders by popularity, name and id', async () => {
    await insertGame(server, { name: 'Popular Game', popularity: 100 })
    await insertGame(server, { name: 'Zeta Quiet', popularity: 1 })
    await insertGame(server, { name: 'Alpha Quiet', popularity: 1 })
    await insertGame(server, { name: 'Featured Second', popularity: 0, featuredRank: 2 })
    await insertGame(server, { name: 'Featured First', popularity: 0, featuredRank: 1 })

    expect(await searchGames('')).toEqual([
      'Featured First',
      'Featured Second',
      'Popular Game',
      'Alpha Quiet',
      'Zeta Quiet',
    ])
  })

  it('keeps the search order, ignoring the featured rank, when there is a search', async () => {
    await insertGame(server, { name: 'Pro League', popularity: 100, featuredRank: 1 })
    await insertGame(server, { name: 'League of Legends', popularity: 10 })

    expect(await searchGames('?search=league')).toEqual(['League of Legends', 'Pro League'])
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

  it('ranks an exact name, then a name prefix, then a contained term, then popularity, name and id', async () => {
    await insertGame(server, { name: 'Pro League', popularity: 100 })
    await insertGame(server, { name: 'League of Legends', popularity: 10 })
    await insertGame(server, { name: 'League', popularity: 1 })
    await insertGame(server, { name: 'Arena League', popularity: 5 })

    expect(await searchGames('?search=league')).toEqual([
      'League',
      'League of Legends',
      'Pro League',
      'Arena League',
    ])
  })

  it('orders equally popular contains matches by name', async () => {
    await insertGame(server, { name: 'Zeta Legends', popularity: 7 })
    await insertGame(server, { name: 'Alpha Legends', popularity: 7 })

    expect(await searchGames('?search=legends')).toEqual(['Alpha Legends', 'Zeta Legends'])
  })

  it('ignores punctuation in the name and in the term', async () => {
    await insertGame(server, { name: 'Counter-Strike 2' })
    await insertGame(server, { name: 'Call of Duty: Modern Warfare' })

    expect(await searchGames('?search=counter%20strike')).toEqual(['Counter-Strike 2'])
    expect(await searchGames('?search=COUNTER-STRIKE')).toEqual(['Counter-Strike 2'])
    expect(await searchGames('?search=duty%20modern%20%20warfare')).toEqual([
      'Call of Duty: Modern Warfare',
    ])
  })

  it('ignores accents in the name and in the term', async () => {
    await insertGame(server, { name: 'Pokémon UNITE' })

    expect(await searchGames('?search=pokemon')).toEqual(['Pokémon UNITE'])
    expect(await searchGames('?search=Pok%C3%A9mon')).toEqual(['Pokémon UNITE'])
  })

  it('finds a game by its alias and ranks the alias match first', async () => {
    await insertGame(server, { name: 'Lollipop Chainsaw', popularity: 500 })
    await insertGame(server, { name: 'Game of Lolz', popularity: 400 })
    await insertGame(server, { name: 'League of Legends', popularity: 1, aliases: ['LoL'] })

    expect(await searchGames('?search=lol')).toEqual([
      'League of Legends',
      'Lollipop Chainsaw',
      'Game of Lolz',
    ])
    expect(await searchGames('?search=LOL')).toEqual([
      'League of Legends',
      'Lollipop Chainsaw',
      'Game of Lolz',
    ])
  })

  it('finds a game by an alias with digits and by a multi-word alias', async () => {
    await insertGame(server, { name: 'Counter-Strike 2', aliases: ['cs2', 'cs'] })
    await insertGame(server, { name: 'Grand Theft Auto Online', aliases: ['gta online'] })

    expect(await searchGames('?search=cs2')).toEqual(['Counter-Strike 2'])
    expect(await searchGames('?search=cs')).toEqual(['Counter-Strike 2'])
    expect(await searchGames('?search=GTA-Online')).toEqual(['Grand Theft Auto Online'])
  })

  it('tolerates an incomplete term by similarity, after the games that match by text', async () => {
    await insertGame(server, { name: 'Valorant', popularity: 1000 })
    await insertGame(server, { name: 'Valorat Quest', popularity: 1 })
    await insertGame(server, { name: 'Dota 2', popularity: 5000 })

    expect(await searchGames('?search=valorat')).toEqual(['Valorat Quest', 'Valorant'])
  })

  it('asks more similarity of a term of three or four letters than of a longer one', async () => {
    await insertGame(server, { name: 'Lost Ark' })
    await insertGame(server, { name: 'Dota 2' })
    await insertGame(server, { name: 'Counter-Strike' })
    await insertGame(server, { name: 'Valorant' })

    // word_similarity('lol', 'lost ark') is 0.5 and ('dotq', 'dota 2') is 0.6: both pass 0.5, not 0.7.
    expect(await searchGames('?search=lol')).toEqual([])
    expect(await searchGames('?search=dotq')).toEqual([])
    // From five letters on 0.5 is enough: ('counetr', 'counter strike') is exactly 0.5, ('vlorant', 'valorant') 0.625.
    expect(await searchGames('?search=counetr')).toEqual(['Counter-Strike'])
    expect(await searchGames('?search=vlorant')).toEqual(['Valorant'])
  })

  it('still finds a game by an alias of three letters, without the games that only start alike', async () => {
    await insertGame(server, { name: 'League of Legends', aliases: ['lol'] })
    await insertGame(server, { name: 'Lost Ark' })
    await insertGame(server, { name: 'Hell Let Loose' })

    expect(await searchGames('?search=lol')).toEqual(['League of Legends'])
  })

  // A defensive guard: "vl" is far below the threshold for "valorant" anyway, so this passes
  // even without the length guard today. It fails if the guard is removed and the threshold drops
  // enough for a one or two letter term to match unrelated names.
  it('does not use similarity for a term of one or two letters', async () => {
    await insertGame(server, { name: 'Dota 2' })
    await insertGame(server, { name: 'Valorant' })

    expect(await searchGames('?search=do')).toEqual(['Dota 2'])
    expect(await searchGames('?search=vl')).toEqual([])
  })

  it('treats %, _ and the escape character as punctuation, never as wildcards', async () => {
    await insertGame(server, { name: '100% Cup' })
    await insertGame(server, { name: '100 Cups' })
    await insertGame(server, { name: 'half_life' })
    await insertGame(server, { name: 'halfXlife' })
    await insertGame(server, { name: 'back\\slash' })
    await insertGame(server, { name: 'backslash' })

    expect((await searchGames('?search=100%25')).sort()).toEqual(['100 Cups', '100% Cup'])
    expect((await searchGames('?search=half_life'))[0]).toBe('half_life')
    // Only the first element: the backslash is punctuation, so "back slash" matches "back\slash" by
    // text, while "backslash" may follow it by similarity. What matters is that the exact name ranks first.
    expect((await searchGames('?search=back%5Cslash'))[0]).toBe('back\\slash')
  })

  it('answers the suggestions for a term made only of punctuation', async () => {
    await insertGame(server, { name: 'Popular Game', popularity: 10 })
    await insertGame(server, { name: 'Featured Game', popularity: 0, featuredRank: 1 })
    await insertGame(server, { name: 'Quiet Game', popularity: 1 })
    const suggestions = ['Featured Game', 'Popular Game', 'Quiet Game']

    expect(await searchGames('')).toEqual(suggestions)
    expect(await searchGames('?search=%25')).toEqual(suggestions)
    expect(await searchGames('?search=_')).toEqual(suggestions)
    expect(await searchGames('?search=%25_%5C')).toEqual(suggestions)
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

  it('rejects a search longer than 100 characters after the trim with 400 VALIDATION_ERROR', async () => {
    const response = await get(server, `/api/games?search=%20${'a'.repeat(101)}%20`)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'VALIDATION_ERROR', message: expect.any(String) })

    expect((await get(server, `/api/games?search=${'a'.repeat(100)}`)).statusCode).toBe(200)
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

  it('returns the platforms of the game', async () => {
    const game = await insertGame(server, { platforms: ['xbox-series', 'switch-2'] })

    const response = await get(server, `/api/games/${game.id}`)

    expect(gameResponseSchema.parse(response.json()).game.platforms).toEqual([
      'xbox-series',
      'switch-2',
    ])
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
