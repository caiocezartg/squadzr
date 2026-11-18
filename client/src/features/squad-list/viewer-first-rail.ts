import { avatarRail, RAIL_LIMIT, type MemberPreviewDto, type RailSlot } from '@squadzr/schemas'

/**
 * Who sits in the viewer's seat: the signed-in player, or the mint "you" disc when there is no
 * session to draw them from.
 */
export type ViewerSeat =
  | {
      readonly kind: 'player'
      readonly id: string
      readonly name: string
      readonly image: string | null
    }
  | { readonly kind: 'you' }

/**
 * Where the viewer's seat is on the rail. `seated`: drawn first, for a member. `on-hover`: folded at
 * the front of an open card; on hover it opens while the last circle folds, so the rail grows by the
 * seat less one circle. `none`: no viewer seat (a full card, a preview).
 */
export type ViewerSeatMode = 'none' | 'seated' | 'on-hover'

export interface CardRail {
  /** The viewer's own seat, first on the rail; `null` when the viewer is not seated. */
  readonly viewer: ViewerSeat | null
  /** The seats after the viewer's: the other members in the preview's order, then the vacant ones. */
  readonly slots: readonly RailSlot[]
  /** The seats past the rail, shown as `+N`. */
  readonly extra: number
}

/**
 * The Squad card's rail with the viewer first. Without a viewer seat it is `avatarRail` as the invite
 * image draws it. With one, the viewer takes the first of the `min(maxPlayers, 5)` seats, whatever
 * their place in the preview, so a member the five-member preview does not reach still sees themself;
 * the other members follow in the preview's order (host first, then by join time).
 */
export function viewerFirstRail(
  memberCount: number,
  maxPlayers: number,
  preview: readonly MemberPreviewDto[] = [],
  viewer: ViewerSeat | null
): CardRail {
  if (!viewer) return { viewer: null, ...avatarRail(memberCount, maxPlayers, preview) }

  const others =
    viewer.kind === 'player' ? preview.filter((member) => member.id !== viewer.id) : preview
  const seats = Math.max(0, Math.min(maxPlayers, RAIL_LIMIT) - 1)
  const filled = Math.max(0, Math.min(memberCount - 1, seats))

  const slots = Array.from({ length: seats }, (_, index): RailSlot => {
    if (index >= filled) return { kind: 'vacant' }
    const member = others[index]
    return member ? { kind: 'member', member } : { kind: 'filled' }
  })

  return { viewer, slots, extra: Math.max(0, maxPlayers - RAIL_LIMIT) }
}

/** The seats that were vacant on the rail `before` and are taken on the rail `after`, in order. */
export function newlyFilledSeats(
  before: readonly RailSlot[],
  after: readonly RailSlot[]
): readonly number[] {
  return after.flatMap((slot, index) =>
    slot.kind !== 'vacant' && before[index]?.kind === 'vacant' ? [index] : []
  )
}
