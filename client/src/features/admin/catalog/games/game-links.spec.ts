/**
 * The links between the Games list and a game's page (#122): the list state a game's page is opened
 * with, and the way back, which is rebuilt from that state and never used as an address.
 */

import { describe, expect, it } from 'vitest'
import { adminGameHref, adminGamesListHref, adminGamesListQuery } from './game-links'

const ID = '7f1c2a4e-5b6d-4c8e-9f0a-1b2c3d4e5f60'

describe('adminGamesListQuery', () => {
  it('leaves out every default value', () => {
    expect(adminGamesListQuery({ search: '', status: 'all', sort: 'popularity', page: 1 })).toBe('')
  })

  it('keeps the search, status, sort and page that differ from the defaults', () => {
    expect(adminGamesListQuery({ search: 'a b', status: 'listed', sort: 'name', page: 3 })).toBe(
      'q=a+b&status=listed&sort=name&page=3'
    )
  })
})

describe('adminGameHref', () => {
  it('is the game’s bare page without a list state', () => {
    expect(adminGameHref(ID)).toBe(`/admin/catalog/games/${ID}`)
  })

  it('carries the list state in `from`, encoded', () => {
    expect(adminGameHref(ID, 'q=a&page=2')).toBe(`/admin/catalog/games/${ID}?from=q%3Da%26page%3D2`)
  })
})

describe('adminGamesListHref', () => {
  it('leads to the bare list without a state', () => {
    expect(adminGamesListHref(null)).toBe('/admin/catalog')
    expect(adminGamesListHref('')).toBe('/admin/catalog')
  })

  it('rebuilds the list state it was given', () => {
    expect(adminGamesListHref('q=val&status=delisted&sort=newest&page=2')).toBe(
      '/admin/catalog?q=val&status=delisted&sort=newest&page=2'
    )
  })

  it('drops invalid values and defaults', () => {
    expect(adminGamesListHref('status=nope&sort=nope&page=-4&q=x')).toBe('/admin/catalog?q=x')
    expect(adminGamesListHref('status=all&sort=popularity&page=1')).toBe('/admin/catalog')
  })

  it('never takes another path, an absolute URL or an unknown parameter', () => {
    expect(adminGamesListHref('//evil.test/x')).toBe('/admin/catalog')
    expect(adminGamesListHref('https://evil.test/?q=x')).toBe('/admin/catalog')
    expect(adminGamesListHref('/admin/squads?q=x&next=https://evil.test')).toBe('/admin/catalog')
    expect(adminGamesListHref('q=x&redirect=https://evil.test')).toBe('/admin/catalog?q=x')
  })
})
