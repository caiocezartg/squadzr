import type { MemberPreviewDto } from './room'

/** The rail never draws more circles than this; the slots beyond them are the `+N` that follows. */
export const RAIL_LIMIT = 5

/**
 * One circle of the rail. A member comes from the preview; a filled slot is a member the preview
 * does not carry (the preview can be shorter than the count, or absent); a vacant slot is still open.
 */
export type RailSlot =
  | { readonly kind: 'member'; readonly member: MemberPreviewDto }
  | { readonly kind: 'filled' }
  | { readonly kind: 'vacant' }

export interface AvatarRail {
  readonly slots: readonly RailSlot[]
  /** The slots past the rail, shown as `+N`; 0 when every slot has a circle. */
  readonly extra: number
}

/**
 * The rail of a Squad (reference, Components, SquadCard): `min(maxPlayers, 5)` circles, the first
 * `min(memberCount, 5)` filled from the preview in order, the rest vacant, then `+N` for the slots past
 * five. The member count stays the authority on how full the Squad is, so a short preview never shrinks
 * the filled part. The Squad card and the invite preview image both draw it.
 */
export function avatarRail(
  memberCount: number,
  maxPlayers: number,
  preview: readonly MemberPreviewDto[] = []
): AvatarRail {
  const shown = Math.max(0, Math.min(maxPlayers, RAIL_LIMIT))
  const filled = Math.max(0, Math.min(memberCount, shown))

  const slots = Array.from({ length: shown }, (_, index): RailSlot => {
    if (index >= filled) return { kind: 'vacant' }
    const member = preview[index]
    return member ? { kind: 'member', member } : { kind: 'filled' }
  })

  return { slots, extra: Math.max(0, maxPlayers - RAIL_LIMIT) }
}
