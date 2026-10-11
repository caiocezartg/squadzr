import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gameResponseSchema, gamesResponseSchema } from '@squadzr/schemas'
import { get, insertGame } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-63: the games routes answer through use cases; an unknown game is 404 GAME_NOT_FOUND.

let server: TestServer

beforeEach(async () => {
  server = await buildTestServer()
})

afterEach(async () => {
  await server.close()
})

describe('GET /api/games', () => {
  it('lists every game to anonymous visitors', async () => {
    const lol = await insertGame(server)
    const cs2 = await insertGame(server)

    const response = await get(server, '/api/games')

    expect(response.statusCode).toBe(200)
    const { games } = gamesResponseSchema.parse(response.json())
    expect(games).toHaveLength(2)
    expect(games).toEqual(expect.arrayContaining([lol, cs2]))
  })
})

describe('GET /api/games/:id', () => {
  it('returns the requested game to anonymous visitors', async () => {
    const game = await insertGame(server)

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
