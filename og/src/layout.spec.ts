import { describe, expect, it } from 'vitest'
import { slotLayout, SLOTS_WIDTH } from './slot-layout'
import { titleSize } from './title-size'

describe('slotLayout', () => {
  it("draws a five-player Squad with the landing's 76px slots and their glyphs", () => {
    expect(slotLayout(5)).toEqual({ size: 76, gap: 14, perRow: 5, glyphs: true })
  })

  it.each([2, 5, 8, 10, 11, 20, 40])(
    'fits %i slots in the slot width, in at most two rows',
    (total) => {
      const layout = slotLayout(total)

      expect(layout.size * layout.perRow + layout.gap * (layout.perRow - 1)).toBeLessThanOrEqual(
        SLOTS_WIDTH
      )
      expect(Math.ceil(total / layout.perRow)).toBeLessThanOrEqual(2)
    }
  )

  it('drops the glyphs from slots too small to read them', () => {
    expect(slotLayout(40).glyphs).toBe(false)
  })
})

describe('titleSize', () => {
  it('shrinks the name as it grows', () => {
    expect(titleSize('Valorant')).toBe(112)
    expect(titleSize('Counter-Strike 2')).toBe(92)
    expect(titleSize('League of Legends')).toBe(76)
    expect(titleSize("Tom Clancy's Rainbow Six Siege X")).toBe(60)
  })
})
