import { describe, expect, it } from 'vitest'
import { addTag } from './add-tag'

describe('addTag', () => {
  it('adds a tag the way the contract writes it', () => {
    expect(addTag(['ranked'], '  #Chill ')).toEqual({ kind: 'added', tags: ['ranked', 'chill'] })
  })

  it('ignores a blank tag and one that is already there', () => {
    expect(addTag(['ranked'], '  ')).toEqual({ kind: 'ignored' })
    expect(addTag(['ranked'], '#')).toEqual({ kind: 'ignored' })
    expect(addTag(['ranked'], 'Ranked')).toEqual({ kind: 'ignored' })
  })

  it('accepts a tag of 12 characters and rejects one of 13', () => {
    expect(addTag([], 'a'.repeat(12))).toEqual({ kind: 'added', tags: ['a'.repeat(12)] })
    expect(addTag([], 'a'.repeat(13))).toEqual({ kind: 'rejected', message: 'Tag too long' })
  })

  it('does not count the leading hash toward the 12 characters', () => {
    expect(addTag([], `#${'a'.repeat(12)}`)).toEqual({ kind: 'added', tags: ['a'.repeat(12)] })
  })

  it('accepts one word of letters with accents, digits and hyphens', () => {
    expect(addTag([], 'Clã-BR2')).toEqual({ kind: 'added', tags: ['clã-br2'] })
  })

  it('rejects text of more than one word instead of splitting it', () => {
    expect(addTag([], 'two words')).toEqual({ kind: 'rejected', message: 'Tag must be one word' })
    expect(addTag([], 'ranked!')).toEqual({ kind: 'rejected', message: 'Tag must be one word' })
  })

  it('accepts the fifth tag and rejects the sixth', () => {
    expect(addTag(['a', 'b', 'c', 'd'], 'e')).toEqual({
      kind: 'added',
      tags: ['a', 'b', 'c', 'd', 'e'],
    })
    expect(addTag(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual({
      kind: 'rejected',
      message: 'Max 5 tags',
    })
  })
})
