import { describe, expect, it } from 'vitest'
import type { MemberPreviewDto } from '@squadzr/schemas'
import { viewerFirstRail } from './viewer-first-rail'

function member(id: string): MemberPreviewDto {
  return { id, name: id, image: null }
}

const host = member('host')
const viewer = { kind: 'player', id: 'me', name: 'Me', image: null } as const

function kinds(slots: ReturnType<typeof viewerFirstRail>['slots']) {
  return slots.map((slot) => (slot.kind === 'member' ? slot.member.id : slot.kind))
}

describe('viewerFirstRail', () => {
  it('is the plain rail when there is no viewer seat', () => {
    const rail = viewerFirstRail(2, 5, [host, member('a')], null)

    expect(rail.viewer).toBeNull()
    expect(kinds(rail.slots)).toEqual(['host', 'a', 'vacant', 'vacant', 'vacant'])
    expect(rail.extra).toBe(0)
  })

  it('takes the viewer out of the preview and seats the others after them, in order', () => {
    const rail = viewerFirstRail(3, 4, [host, member('me'), member('b')], viewer)

    expect(rail.viewer).toEqual(viewer)
    expect(kinds(rail.slots)).toEqual(['host', 'b', 'vacant'])
    expect(rail.extra).toBe(0)
  })

  it('seats a viewer the five-member preview does not reach, in a ten-player Squad', () => {
    const preview = [host, member('a'), member('b'), member('c'), member('d')]
    const rail = viewerFirstRail(7, 10, preview, viewer)

    expect(rail.viewer).toEqual(viewer)
    expect(kinds(rail.slots)).toEqual(['host', 'a', 'b', 'c'])
    expect(rail.extra).toBe(5)
  })

  it('fills the seats a short preview does not reach with neutral circles', () => {
    const rail = viewerFirstRail(4, 5, [member('me'), host], viewer)

    expect(kinds(rail.slots)).toEqual(['host', 'filled', 'filled', 'vacant'])
  })

  it('seats the signed-out "you" first, without touching the preview', () => {
    const rail = viewerFirstRail(2, 3, [host, member('a')], { kind: 'you' })

    expect(rail.viewer).toEqual({ kind: 'you' })
    expect(kinds(rail.slots)).toEqual(['host', 'vacant'])
  })

  it('keeps the viewer seated alone in a Squad of one', () => {
    const rail = viewerFirstRail(1, 2, [member('me')], viewer)

    expect(kinds(rail.slots)).toEqual(['vacant'])
  })
})
