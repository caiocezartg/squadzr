import { describe, expect, it } from 'vitest'
import {
  adminGameDetailResponseSchema,
  adminGameSchema,
  adminGamesQuerySchema,
  adminGamesSummarySchema,
} from './index'

const game = {
  id: '5b2f0c1e-8d34-4e6a-9d6f-2f0a4c7b1a10',
  name: 'Counter-Strike 2',
  slug: 'counter-strike-2',
  coverThumbUrl: 'https://images.example/cs2-thumb.jpg',
  platforms: ['pc'],
  minPlayers: 2,
  maxPlayers: 5,
  popularity: 980,
  featuredRank: 1,
  listed: true,
  usage: { openSquads: 3, completedSquads: 41 },
}

describe('admin games query', () => {
  it('defaults to the first page and leaves the filters absent', () => {
    expect(adminGamesQuerySchema.parse({})).toEqual({ page: 1 })
  })

  it('trims the search and reads a blank search or an empty filter as absent', () => {
    expect(adminGamesQuerySchema.parse({ q: '  cs2  ', status: 'delisted', sort: 'name' })).toEqual(
      {
        page: 1,
        q: 'cs2',
        status: 'delisted',
        sort: 'name',
      }
    )
    expect(adminGamesQuerySchema.parse({ q: '   ', status: '', sort: '' })).toEqual({ page: 1 })
  })

  it('refuses an unknown status or sort and a search over the limit', () => {
    expect(adminGamesQuerySchema.safeParse({ status: 'hidden' }).success).toBe(false)
    expect(adminGamesQuerySchema.safeParse({ sort: 'random' }).success).toBe(false)
    expect(adminGamesQuerySchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false)
  })
})

describe('admin game', () => {
  it('carries a row with its usage', () => {
    expect(adminGameSchema.parse(game)).toEqual(game)
  })

  it('carries the detail with the game fields and its Open Squads', () => {
    const detail = {
      game: {
        ...game,
        igdbId: 1234,
        genres: [{ slug: 'shooter', name: 'Shooter' }],
        aliases: ['cs2', 'counter strike'],
        coverUrl: 'https://images.example/cs2.jpg',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-11-05T04:00:03.000Z',
      },
      openSquads: [],
    }

    expect(adminGameDetailResponseSchema.parse(detail)).toEqual(detail)
  })
})

describe('admin games summary', () => {
  it('carries the counts and the games of the last import', () => {
    const summary = {
      listed: 1675,
      delisted: 12,
      featured: 8,
      lastImport: {
        runId: 'run-1',
        finishedAt: '2026-11-05T04:00:04.000Z',
        entered: { total: 7, games: [{ id: game.id, name: game.name }] },
        left: { total: 0, games: [] },
      },
    }

    expect(adminGamesSummarySchema.parse(summary)).toEqual(summary)
  })

  it('has no last import before a run succeeded', () => {
    const summary = { listed: 0, delisted: 0, featured: 0, lastImport: null }

    expect(adminGamesSummarySchema.parse(summary)).toEqual(summary)
  })
})
