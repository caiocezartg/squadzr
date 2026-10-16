import { describe, expect, it } from 'vitest'
import {
  ROOMS_SEARCH_DEFAULTS,
  parseLanguageFilter,
  parseSort,
  parseStatusFilter,
  resolveRoomsSearch,
  roomsSearchSchema,
} from './rooms-search'

describe('roomsSearchSchema', () => {
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
    expect(roomsSearchSchema.parse(raw)).toEqual(raw)
  })

  it('leaves out a parameter that is missing', () => {
    expect(roomsSearchSchema.parse({})).toEqual({})
  })

  it('drops each invalid parameter and keeps the valid ones, join included', () => {
    const parsed = roomsSearchSchema.parse({
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
    expect(resolveRoomsSearch(roomsSearchSchema.parse({ page })).page).toBe(1)
  })

  it('reads a page given as text', () => {
    expect(roomsSearchSchema.parse({ page: '4' }).page).toBe(4)
  })

  it('does not throw for a search that is not an object', () => {
    expect(roomsSearchSchema.parse(undefined)).toEqual({})
  })
})

describe('resolveRoomsSearch', () => {
  it('fills every missing parameter with its default', () => {
    expect(resolveRoomsSearch({})).toEqual(ROOMS_SEARCH_DEFAULTS)
    expect(ROOMS_SEARCH_DEFAULTS).toEqual({
      search: '',
      filter: 'all',
      sort: 'newest',
      language: 'all',
      tag: '',
      page: 1,
    })
  })

  it('keeps the parameters it was given', () => {
    expect(resolveRoomsSearch({ sort: 'oldest', page: 2 })).toMatchObject({
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
