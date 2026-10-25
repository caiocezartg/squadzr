import { describe, expect, it } from 'vitest'
import type { PublicSquad } from '@/types'
import { SQUADS_SEARCH_DEFAULTS } from './squads-search'
import { querySquadList, type SquadListQuery } from './squad-list-query'

const lol: PublicSquad['game'] = {
  id: 'game-lol',
  name: 'League of Legends',
  slug: 'lol',
  genres: [],
  coverUrl: 'https://cdn.squadzr.test/lol.jpg',
  coverThumbUrl: 'https://cdn.squadzr.test/lol-thumb.jpg',
}
const cs2: PublicSquad['game'] = {
  id: 'game-cs2',
  name: 'Counter-Strike 2',
  slug: 'cs2',
  genres: [],
  coverUrl: 'https://cdn.squadzr.test/cs2.jpg',
  coverThumbUrl: 'https://cdn.squadzr.test/cs2-thumb.jpg',
}

function squad(overrides: Partial<PublicSquad> & { id: string }): PublicSquad {
  return {
    code: overrides.id.toUpperCase(),
    name: `Squad ${overrides.id}`,
    hostId: 'host',
    gameId: lol.id,
    game: lol,
    maxPlayers: 5,
    tags: [],
    language: 'en',
    memberCount: 1,
    memberPreview: [],
    isMember: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function query(overrides: Partial<SquadListQuery> = {}): SquadListQuery {
  return { ...SQUADS_SEARCH_DEFAULTS, ...overrides }
}

function ids(squads: PublicSquad[]): string[] {
  return squads.map((squad) => squad.id)
}

function squads(count: number): PublicSquad[] {
  return Array.from({ length: count }, (_, index) =>
    squad({ id: `s${index + 1}`, createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString() })
  )
}

describe('querySquadList — filters', () => {
  const ranked = squad({ id: 'ranked', name: 'Ranked grind', tags: ['Ranked', 'chill'] })
  const full = squad({
    id: 'full',
    name: 'Full lobby',
    gameId: cs2.id,
    game: cs2,
    maxPlayers: 4,
    memberCount: 4,
    language: 'pt-br',
  })
  const almost = squad({ id: 'almost', maxPlayers: 4, memberCount: 3, language: 'pt-br' })
  const unknownSize = squad({ id: 'unknown', memberCount: undefined })
  const all = [ranked, full, almost, unknownSize]

  it('keeps every squad with the default query', () => {
    expect(querySquadList(all, query()).matching).toHaveLength(all.length)
  })

  it('matches the search term against the squad name, ignoring case', () => {
    expect(ids(querySquadList(all, query({ search: 'RANKED' })).matching)).toEqual(['ranked'])
  })

  it('matches the search term against the game name', () => {
    expect(ids(querySquadList(all, query({ search: 'counter' })).matching)).toEqual(['full'])
  })

  it('ignores a blank search term', () => {
    expect(querySquadList(all, query({ search: '   ' })).matching).toHaveLength(4)
  })

  it('keeps only squads with a free slot for has-space', () => {
    expect(ids(querySquadList(all, query({ filter: 'has-space' })).matching).sort()).toEqual([
      'almost',
      'ranked',
      'unknown',
    ])
  })

  it('keeps only squads one slot from full for almost-full', () => {
    expect(ids(querySquadList(all, query({ filter: 'almost-full' })).matching)).toEqual(['almost'])
  })

  it('counts a squad without a member count as one member', () => {
    const duo = squad({ id: 'duo', maxPlayers: 2, memberCount: undefined })
    expect(ids(querySquadList([duo], query({ filter: 'almost-full' })).matching)).toEqual(['duo'])
  })

  it('keeps only the chosen language', () => {
    expect(ids(querySquadList(all, query({ language: 'pt-br' })).matching).sort()).toEqual([
      'almost',
      'full',
    ])
  })

  it('matches the tag by substring, ignoring case, spaces and a leading #', () => {
    expect(ids(querySquadList(all, query({ tag: ' #RANK ' })).matching)).toEqual(['ranked'])
  })

  it('ignores a blank tag', () => {
    expect(querySquadList(all, query({ tag: ' ' })).matching).toHaveLength(4)
  })

  it('combines every filter', () => {
    const result = querySquadList(all, query({ language: 'pt-br', filter: 'has-space' }))
    expect(ids(result.matching)).toEqual(['almost'])
  })
})

describe('querySquadList — sort', () => {
  const old = squad({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' })
  const mid = squad({ id: 'mid', createdAt: '2026-02-01T00:00:00.000Z' })
  const recent = squad({ id: 'recent', createdAt: '2026-03-01T00:00:00.000Z' })
  const shuffled = [mid, recent, old]

  it('puts the newest squad first by default', () => {
    expect(ids(querySquadList(shuffled, query()).matching)).toEqual(['recent', 'mid', 'old'])
  })

  it('puts the newest squad first for newest', () => {
    expect(ids(querySquadList(shuffled, query({ sort: 'newest' })).matching)).toEqual([
      'recent',
      'mid',
      'old',
    ])
  })

  it('puts the oldest squad first for oldest', () => {
    expect(ids(querySquadList(shuffled, query({ sort: 'oldest' })).matching)).toEqual([
      'old',
      'mid',
      'recent',
    ])
  })

  it('does not reorder the squads it was given', () => {
    querySquadList(shuffled, query())
    expect(ids(shuffled)).toEqual(['mid', 'recent', 'old'])
  })
})

describe('querySquadList — pagination', () => {
  it('shows six squads per page', () => {
    const result = querySquadList(squads(7), query())
    expect(result.pageSquads).toHaveLength(6)
    expect(result).toMatchObject({ currentPage: 1, totalPages: 2, hasNextPage: true })
    expect(result.hasPreviousPage).toBe(false)
  })

  it('keeps exactly six squads on a single page', () => {
    const result = querySquadList(squads(6), query())
    expect(result).toMatchObject({ currentPage: 1, totalPages: 1, hasNextPage: false })
  })

  it('puts the remainder on the last page', () => {
    const result = querySquadList(squads(7), query({ page: 2 }))
    expect(ids(result.pageSquads)).toEqual(['s1'])
    expect(result).toMatchObject({ currentPage: 2, hasPreviousPage: true, hasNextPage: false })
  })

  it('cuts the page from the sorted list, not from the given order', () => {
    const result = querySquadList(squads(7), query({ page: 1 }))
    expect(ids(result.pageSquads)).toEqual(['s7', 's6', 's5', 's4', 's3', 's2'])
  })

  it('resolves a page past the last to the last page', () => {
    const result = querySquadList(squads(7), query({ page: 99 }))
    expect(result.currentPage).toBe(2)
    expect(ids(result.pageSquads)).toEqual(['s1'])
  })

  it('has one empty page when nothing matches', () => {
    const result = querySquadList(squads(3), query({ search: 'nothing' }))
    expect(result).toMatchObject({ currentPage: 1, totalPages: 1, pageSquads: [], matching: [] })
    expect(result.pageRange).toEqual([1])
  })

  it('paginates the filtered squads', () => {
    const result = querySquadList(squads(14), query({ search: 'squad s1' }))
    expect(result.matching).toHaveLength(6)
    expect(result.totalPages).toBe(1)
  })

  it('lists every page up to seven', () => {
    expect(querySquadList(squads(42), query({ page: 4 })).pageRange).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('collapses the page list past seven pages', () => {
    const pages = (page: number) => querySquadList(squads(60), query({ page })).pageRange
    expect(pages(1)).toEqual([1, 2, 10])
    expect(pages(5)).toEqual([1, 4, 5, 6, 10])
    expect(pages(10)).toEqual([1, 9, 10])
  })
})
