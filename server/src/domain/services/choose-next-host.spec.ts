import { describe, expect, it } from 'vitest'
import { chooseNextHost } from './choose-next-host'

const at = (clock: string) => new Date(`2026-01-01T${clock}.000Z`)

describe('chooseNextHost', () => {
  it('picks the member who has been in the Squad the longest', () => {
    const members = [
      { userId: 'carol', joinedAt: at('12:30:00') },
      { userId: 'alice', joinedAt: at('12:00:00') },
      { userId: 'bob', joinedAt: at('12:10:00') },
    ]

    expect(chooseNextHost(members, new Set())).toBe('alice')
  })

  it('breaks a tie on joinedAt with the smaller userId, whatever the order of the list', () => {
    const joinedAt = at('12:00:00')
    const members = [
      { userId: 'user-b', joinedAt },
      { userId: 'user-a', joinedAt },
      { userId: 'user-c', joinedAt },
    ]

    expect(chooseNextHost(members, new Set())).toBe('user-a')
    expect(chooseNextHost([...members].reverse(), new Set())).toBe('user-a')
  })

  it('skips the ineligible, even the oldest', () => {
    const members = [
      { userId: 'alice', joinedAt: at('12:00:00') },
      { userId: 'bob', joinedAt: at('12:10:00') },
      { userId: 'carol', joinedAt: at('12:20:00') },
    ]

    expect(chooseNextHost(members, new Set(['alice']))).toBe('bob')
    expect(chooseNextHost(members, new Set(['alice', 'bob']))).toBe('carol')
  })

  it('returns null when nobody is eligible', () => {
    const members = [
      { userId: 'alice', joinedAt: at('12:00:00') },
      { userId: 'bob', joinedAt: at('12:10:00') },
    ]

    expect(chooseNextHost(members, new Set(['alice', 'bob']))).toBeNull()
  })

  it('returns null for a Squad with no members left', () => {
    expect(chooseNextHost([], new Set())).toBeNull()
  })
})
