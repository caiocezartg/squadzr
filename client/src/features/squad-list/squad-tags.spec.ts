import { describe, expect, it } from 'vitest'
import type { PublicSquad } from '@/types'
import { hasEveryTag, normalizeTag, normalizeTags, rankTagOptions } from './squad-tags'

function squad(tags: string[]): PublicSquad {
  return { tags } as PublicSquad
}

describe('normalizeTag', () => {
  it('trims, drops leading # signs and lowercases', () => {
    expect(normalizeTag(' ##Ranked ')).toBe('ranked')
  })

  it('leaves a blank tag empty', () => {
    expect(normalizeTag(' # ')).toBe('')
  })
})

describe('normalizeTags', () => {
  it('drops blanks and repeats and keeps the order', () => {
    expect(normalizeTags(['Mic', '#ranked', 'mic', ' ', 'RANKED'])).toEqual(['mic', 'ranked'])
  })
})

describe('hasEveryTag', () => {
  it('needs every selected tag, compared exactly', () => {
    const tagged = squad(['Ranked', '#mic'])
    expect(hasEveryTag(tagged, ['ranked', 'mic'])).toBe(true)
    expect(hasEveryTag(tagged, ['ranked', 'chill'])).toBe(false)
    expect(hasEveryTag(tagged, ['rank'])).toBe(false)
  })

  it('matches every squad for an empty selection', () => {
    expect(hasEveryTag(squad([]), [])).toBe(true)
  })
})

describe('rankTagOptions', () => {
  it('ranks by use, then by name', () => {
    const squads = [squad(['b', 'a']), squad(['b', 'c']), squad(['c', 'Z'])]
    expect(rankTagOptions(squads, [])).toEqual(['b', 'c', 'a', 'z'])
  })

  it('lists at most eight tags', () => {
    const squads = [squad(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])]
    expect(rankTagOptions(squads, [])).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
  })

  it('adds each selected tag that is not among them, in the order selected', () => {
    const squads = [squad(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])]
    expect(rankTagOptions(squads, ['i', 'a', 'zzz'])).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'zzz',
    ])
  })

  it('counts a squad once per tag and normalizes the tags it counts', () => {
    expect(rankTagOptions([squad(['Mic', '#mic'])], [])).toEqual(['mic'])
  })
})
