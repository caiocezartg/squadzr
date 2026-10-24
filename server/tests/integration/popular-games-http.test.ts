import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { popularGamesResponseSchema, type PopularGamesResponse } from '@squadzr/schemas'
import { signIn } from '@test/harness/auth'
import { FakeClock } from '@test/harness/clock'
import { createRoom, get, insertGame, setRoomLifecycle } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-96: the landing's popular games endpoint ranks Listed Games by Open
// Squads, falls back to the Featured Games on a quiet day, and aggregates the
// open count and top tags in one read.

const NOW = new Date('2031-06-01T12:00:00Z')
const DAY_MS = 24 * 60 * 60_000

let server: TestServer

beforeEach(async () => {
  const clock = new FakeClock(NOW)
  server = await buildTestServer({}, { clock })
})

afterEach(async () => {
  await server.close()
})

async function readPopular(query = ''): Promise<PopularGamesResponse> {
  const response = await get(server, `/api/games/popular${query}`)
  expect(response.statusCode, response.body).toBe(200)
  return popularGamesResponseSchema.parse(response.json())
}

async function popularNames(query = ''): Promise<string[]> {
  const { games } = await readPopular(query)
  return games.map((entry) => entry.game.name)
}

/** Creates an Open Squad on a fresh host, so the per-host create limit never applies. */
async function openSquad(gameId: string, tags: string[] = []) {
  const host = await signIn(server, 'Host')
  return createRoom(server, host, { gameId, tags })
}

async function expiredSquad(gameId: string, tags: string[] = []) {
  const room = await openSquad(gameId, tags)
  await setRoomLifecycle(server, room.id, {
    createdAt: new Date(NOW.getTime() - 2 * DAY_MS),
    lastActivityAt: new Date(NOW.getTime() - DAY_MS - 1),
    readyAt: null,
  })
  return room
}

async function readySquad(gameId: string, tags: string[] = []) {
  const room = await openSquad(gameId, tags)
  await setRoomLifecycle(server, room.id, {
    createdAt: new Date(NOW.getTime() - 60_000),
    lastActivityAt: new Date(NOW.getTime() - 30_000),
    readyAt: new Date(NOW.getTime() - 10_000),
  })
  return room
}

describe('GET /api/games/popular', () => {
  it('answers anonymous visitors with the ranked Listed Games', async () => {
    const arena = await insertGame(server, { name: 'Arena', popularity: 10 })
    const brawl = await insertGame(server, { name: 'Brawl', popularity: 5, featuredRank: 2 })
    const clash = await insertGame(server, { name: 'Clash', popularity: 1, featuredRank: 1 })
    await insertGame(server, { name: 'Duel', popularity: 100 })
    await insertGame(server, { name: 'Echo', popularity: 100 })
    await insertGame(server, { name: 'Faint', popularity: 50 })
    await insertGame(server, { name: 'Fable', popularity: 0, featuredRank: 3 })
    await insertGame(server, { name: 'Delisted', popularity: 1_000, listed: false })

    await openSquad(arena.id)
    await openSquad(arena.id)
    await openSquad(brawl.id)
    await openSquad(clash.id)

    // Open Squads descending, then featured rank, popularity and name; the
    // delisted Game is absent.
    expect(await popularNames()).toEqual([
      'Arena',
      'Clash',
      'Brawl',
      'Fable',
      'Duel',
      'Echo',
      'Faint',
    ])
  })

  it('fills the list with Featured Games when no Squads are open', async () => {
    await insertGame(server, { name: 'Featured Two', popularity: 1, featuredRank: 2 })
    await insertGame(server, { name: 'Featured One', popularity: 1, featuredRank: 1 })
    await insertGame(server, { name: 'Popular', popularity: 100 })
    await insertGame(server, { name: 'Quiet', popularity: 1 })

    expect(await popularNames()).toEqual(['Featured One', 'Featured Two', 'Popular', 'Quiet'])
  })

  it('does not count expired or Ready Squads', async () => {
    const busy = await insertGame(server, { name: 'Busy' })
    const quiet = await insertGame(server, { name: 'Quiet' })

    await openSquad(busy.id, ['live'])
    await expiredSquad(busy.id, ['stale'])
    await readySquad(busy.id, ['done'])

    await expiredSquad(quiet.id, ['stale'])
    await readySquad(quiet.id, ['done'])

    const { games } = await readPopular()

    expect(games).toEqual([
      expect.objectContaining({
        game: expect.objectContaining({ name: 'Busy' }),
        openSquadCount: 1,
        topTags: ['live'],
      }),
      expect.objectContaining({
        game: expect.objectContaining({ name: 'Quiet' }),
        openSquadCount: 0,
        topTags: [],
      }),
    ])
  })

  it('ranks the top tags by use, then alphabetically, keeping three', async () => {
    const game = await insertGame(server, { name: 'Tagged' })

    await openSquad(game.id, ['ranked', 'chill'])
    await openSquad(game.id, ['ranked', 'casual'])
    await openSquad(game.id, ['chill', 'casual'])
    // A repeated tag counts once for its Squad; `duo` is the fourth tag by use.
    await openSquad(game.id, ['ranked', 'ranked', 'duo'])
    await readySquad(game.id, ['aaa'])
    await expiredSquad(game.id, ['zzz'])

    const [entry] = (await readPopular()).games

    expect(entry).toMatchObject({
      openSquadCount: 4,
      topTags: ['ranked', 'casual', 'chill'],
    })
  })

  it('returns the total of Listed Games even when the page is shorter', async () => {
    await insertGame(server, { name: 'One', popularity: 3 })
    await insertGame(server, { name: 'Two', popularity: 2 })
    await insertGame(server, { name: 'Three', popularity: 1 })
    await insertGame(server, { name: 'Delisted', popularity: 0, listed: false })

    const page = await readPopular('?limit=1')

    expect(page.totalGames).toBe(3)
    expect(page.games).toHaveLength(1)
    expect(page.games[0]?.game.name).toBe('One')
  })

  it('defaults to eight games and accepts a limit from 1 to 20', async () => {
    for (let index = 0; index < 21; index += 1) {
      await insertGame(server, {
        name: `Game ${String(index).padStart(2, '0')}`,
        popularity: 100 - index,
      })
    }

    expect((await readPopular()).games).toHaveLength(8)
    expect((await readPopular('?limit=1')).games).toHaveLength(1)
    expect((await readPopular('?limit=20')).games).toHaveLength(20)
  })

  it.each(['limit=0', 'limit=21', 'limit=1.5', 'limit=many'])(
    'rejects the invalid %s with 400 VALIDATION_ERROR',
    async (query) => {
      const response = await get(server, `/api/games/popular?${query}`)

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({
        error: 'VALIDATION_ERROR',
        message: expect.any(String),
      })
    }
  )
})
