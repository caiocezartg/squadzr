import { describe, expect, it } from 'vitest'
import { previewMembers } from '@/test/fixtures'
import { avatarRail } from './avatar-rail'

function kinds(memberCount: number, maxPlayers: number, previewCount = memberCount) {
  const rail = avatarRail(memberCount, maxPlayers, previewMembers(previewCount))
  return { kinds: rail.slots.map((slot) => slot.kind), extra: rail.extra }
}

describe('avatarRail', () => {
  it('fills 3 of 5 from the preview and leaves two vacant', () => {
    expect(kinds(3, 5)).toEqual({
      kinds: ['member', 'member', 'member', 'vacant', 'vacant'],
      extra: 0,
    })
  })

  it('fills a full squad of 5 with no vacant circle', () => {
    expect(kinds(5, 5)).toEqual({ kinds: Array(5).fill('member'), extra: 0 })
  })

  it('caps 3 of 10 at five circles and counts the other five slots as +5', () => {
    expect(kinds(3, 10)).toEqual({
      kinds: ['member', 'member', 'member', 'vacant', 'vacant'],
      extra: 5,
    })
  })

  it('caps 8 of 10 at five filled circles, whose preview holds five members', () => {
    expect(kinds(8, 10, 5)).toEqual({ kinds: Array(5).fill('member'), extra: 5 })
  })

  it('fills the circles the preview does not reach with a neutral filled circle', () => {
    expect(kinds(4, 5, 2)).toEqual({
      kinds: ['member', 'member', 'filled', 'filled', 'vacant'],
      extra: 0,
    })
  })

  it('takes the members in the order of the preview', () => {
    const preview = previewMembers(3)
    const rail = avatarRail(3, 5, preview)

    expect(rail.slots.slice(0, 3)).toEqual(preview.map((member) => ({ kind: 'member', member })))
  })

  it('draws fewer circles than five for a smaller squad', () => {
    expect(kinds(1, 3)).toEqual({ kinds: ['member', 'vacant', 'vacant'], extra: 0 })
  })

  it('never fills more circles than the squad has slots', () => {
    expect(kinds(7, 4, 4)).toEqual({ kinds: Array(4).fill('member'), extra: 0 })
  })
})
