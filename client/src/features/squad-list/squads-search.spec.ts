import { describe, expect, it } from 'vitest'
import {
  SQUADS_SEARCH_DEFAULTS,
  parseLanguageFilter,
  parseSort,
  parseStatusFilter,
  resolveSquadsSearch,
  squadsSearchSchema,
} from './squads-search'

describe('squadsSearchSchema', () => {
  it('keeps every valid parameter', () => {
    const raw = {
      search: 'ranked',
      filter: 'almost-full',
      sort: 'oldest',
      language: 'pt-br',
      tag: 'duo',
      page: 3,
      join: 'ABC123',
    }
    expect(squadsSearchSchema.parse(raw)).toEqual(raw)
  })

  it.each(['../../admin', 'ABC12', 'ABC1234', 'ABC 12', '%2F%2E%2E'])(
    'drops a join value that is not a room code: %s',
    (join) => {
      expect(squadsSearchSchema.parse({ join }).join).toBeUndefined()
    }
  )

  it('keeps a lowercase room code, which the server reads without regard to case', () => {
    expect(squadsSearchSchema.parse({ join: 'abc123' }).join).toBe('abc123')
  })

  it('leaves out a parameter that is missing', () => {
    expect(squadsSearchSchema.parse({})).toEqual({})
  })

  it('drops each invalid parameter and keeps the valid ones, join included', () => {
    const parsed = squadsSearchSchema.parse({
      search: 42,
      filter: 'bogus',
      sort: 'sideways',
      language: 'fr',
      tag: ['a'],
      page: 0,
      join: 'ABC123',
    })
    expect(parsed).toEqual({ join: 'ABC123' })
  })

  it.each([0, -2, 1.5, 'abc', null])('falls back to page 1 for page=%s', (page) => {
    expect(resolveSquadsSearch(squadsSearchSchema.parse({ page })).page).toBe(1)
  })

  it('reads a page given as text', () => {
    expect(squadsSearchSchema.parse({ page: '4' }).page).toBe(4)
  })

  it('does not throw for a search that is not an object', () => {
    expect(squadsSearchSchema.parse(undefined)).toEqual({})
  })
})

describe('resolveSquadsSearch', () => {
  it('fills every missing parameter with its default', () => {
    expect(resolveSquadsSearch({})).toEqual(SQUADS_SEARCH_DEFAULTS)
    expect(SQUADS_SEARCH_DEFAULTS).toEqual({
      search: '',
      filter: 'all',
      sort: 'newest',
      language: 'all',
      tag: '',
      page: 1,
    })
  })

  it('keeps the parameters it was given', () => {
    expect(resolveSquadsSearch({ sort: 'oldest', page: 2 })).toMatchObject({
      sort: 'oldest',
      page: 2,
      filter: 'all',
    })
  })
})

describe('control value parsers', () => {
  it('accept the values the contract names', () => {
    expect(parseStatusFilter('has-space')).toBe('has-space')
    expect(parseSort('oldest')).toBe('oldest')
    expect(parseLanguageFilter('pt-br')).toBe('pt-br')
  })

  it('reject anything else', () => {
    expect(parseStatusFilter('nope')).toBeUndefined()
    expect(parseSort('')).toBeUndefined()
    expect(parseLanguageFilter(undefined)).toBeUndefined()
  })
})
