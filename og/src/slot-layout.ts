/** How the row of slots is drawn: the circle size, the gap and how many circles fit in a row. */
export interface SlotLayout {
  readonly size: number
  readonly gap: number
  readonly perRow: number
  /** Small circles drop the person glyph and the "+", which would not read at that size. */
  readonly glyphs: boolean
}

/** The width the slots may take, next to the count, inside the 600px safe column. */
export const SLOTS_WIDTH = 440

const LARGEST_SLOT = 76

/**
 * Up to ten slots sit in one row, as big as the width allows (a five-player Squad gets the landing's
 * 76px circles). Larger Squads wrap into two rows of smaller circles.
 */
export function slotLayout(total: number): SlotLayout {
  const perRow = total <= 10 ? total : Math.ceil(total / 2)
  const gap = perRow <= 5 ? 14 : perRow <= 10 ? 10 : 6
  const size = Math.min(LARGEST_SLOT, Math.floor((SLOTS_WIDTH - gap * (perRow - 1)) / perRow))
  return { size, gap, perRow, glyphs: size >= 36 }
}
