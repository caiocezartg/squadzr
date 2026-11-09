/** A Squad of more slots than this still draws this many segments, so every meter is the same length. */
export const MAX_SEGMENTS = 5

interface SlotMeterFill {
  readonly segments: number
  readonly lit: number
}

/**
 * How many segments the slot meter draws and lights. A Squad of {@link MAX_SEGMENTS} slots or fewer
 * gets one segment per slot; a bigger one is scaled down. The rounding stays honest: nobody joined
 * means nothing lit, a full Squad means everything lit, and anything between never reads as empty
 * or full.
 */
export function computeSlotMeterFill(filled: number, total: number): SlotMeterFill {
  const slots = Math.max(1, total)
  const segments = Math.min(slots, MAX_SEGMENTS)
  const members = Math.min(slots, Math.max(0, filled))

  if (members === 0) return { segments, lit: 0 }
  if (members === slots) return { segments, lit: segments }

  const scaled = Math.round((members / slots) * segments)
  return { segments, lit: Math.min(segments - 1, Math.max(1, scaled)) }
}
