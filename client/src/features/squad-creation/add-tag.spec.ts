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

  it('accepts a tag of 15 characters and rejects one of 16', () => {
    expect(addTag([], 'a'.repeat(15))).toEqual({ kind: 'added', tags: ['a'.repeat(15)] })
    expect(addTag([], 'a'.repeat(16))).toEqual({ kind: 'rejected', message: 'Tag too long' })
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
