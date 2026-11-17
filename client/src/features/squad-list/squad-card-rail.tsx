import type { CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import type { RailSlot } from '@squadzr/schemas'
import { Avatar } from '@/components/ds/avatar'
import { cn } from '@/lib/utils'
import { useFittingCircles } from './use-fitting-circles'
import type { CardRail, ViewerSeat, ViewerSeatMode } from './viewer-first-rail'

/** How far apart the seats of one arrival fill, and how long after a seat fills its outline throws. */
const ARRIVAL_STAGGER_MS = 250
const ARRIVAL_PING_MS = 120

interface SquadCardRailProps {
  readonly rail: CardRail
  /** Where the viewer's seat is: drawn first for a member, folded until hover on an open card. */
  readonly seat: ViewerSeatMode
  /** Who opens into the folded seat of an open card on hover. */
  readonly hoverViewer: ViewerSeat | null
  /** The seats (indexes into `rail.slots`) a live arrival fills, in order. */
  readonly arriving: readonly number[]
  /** Restarts the arrival's animation for each new arrival. */
  readonly arrivalId: number | null
}

/**
 * The card's rail: the viewer's seat first (a member's, or the open card's folded one), then the
 * others' circles that fit whole, then `+N` for every seat the rail does not draw. On an open card's
 * hover the viewer's seat opens while the last circle folds, so the rail keeps its width and the `+N`
 * keeps its number: it counts seats, not people. The rail's padding, taken back by its margins, leaves
 * the rings, the glow and the arrival's outline room inside its clip.
 */
export function SquadCardRail({
  rail,
  seat,
  hoverViewer,
  arriving,
  arrivalId,
}: SquadCardRailProps) {
  const viewer = seat === 'seated' ? rail.viewer : seat === 'on-hover' ? hoverViewer : null
  const { railRef, shown } = useFittingCircles(rail.slots.length, rail.extra > 0, seat)
  // The circles that do not fit join the seats past the rail in the `+N`.
  const extra = rail.extra + (rail.slots.length - shown)

  return (
    <span
      ref={railRef}
      className="-my-3 -ml-3.5 flex min-w-0 flex-1 items-center overflow-hidden py-3 pr-0.5 pl-3.5"
    >
      {viewer && <ViewerSeatCircle viewer={viewer} folded={seat === 'on-hover'} />}
      {rail.slots.slice(0, shown).map((slot, index) => {
        const order = arriving.indexOf(index)
        return (
          <RailCircle
            key={order >= 0 ? `${index}:${arrivalId}` : index}
            slot={slot}
            first={index === 0 && !viewer}
            folds={seat === 'on-hover' && index === shown - 1}
            arrivalOrder={order >= 0 ? order : null}
          />
        )
      })}
      {extra > 0 && (
        <span className="ml-3.5 shrink-0 font-mono text-xs font-bold text-text-3">+{extra}</span>
      )}
    </span>
  )
}

/**
 * The viewer's seat: larger than the others, ringed in mint, cut out of the card's ground and lit, on
 * top of the circle after it with 6px more room. The avatar draws at 44px and shrinks to 34px below
 * the wide breakpoint. Folded (an open card), it waits at zero width and opens on hover, popping in
 * and throwing a mint ring once; the folded seat is decoration, so it is hidden from assistive tech.
 */
function ViewerSeatCircle({
  viewer,
  folded,
}: {
  readonly viewer: ViewerSeat
  readonly folded: boolean
}) {
  return (
    <span
      data-viewer-seat=""
      aria-hidden={folded || undefined}
      className={cn(
        'relative z-1 mr-1.5 block shrink-0',
        folded
          ? 'w-0 scale-40 opacity-0 transition-[width,opacity,scale] [transition-duration:350ms,200ms,450ms] [transition-timing-function:var(--ease-out),ease,var(--ease-spring)] card-lit:w-8.5 card-lit:scale-100 card-lit:opacity-100 lg:card-lit:w-11'
          : 'w-8.5 lg:w-11'
      )}
    >
      <span
        data-rail-viewer-face=""
        className="relative block size-8.5 rounded-full shadow-[0_0_0_2px_var(--color-mint),0_0_0_4px_var(--color-squad-cut),0_0_14px_rgba(0,255,162,0.4)] lg:size-11"
      >
        <span className="block size-11 origin-top-left scale-[0.7727] lg:scale-100">
          <ViewerFace viewer={viewer} labelled={!folded} />
        </span>
        {folded && (
          <span className="pointer-events-none absolute -inset-1.5 rounded-full border-2 border-mint opacity-0 motion-safe:card-lit:animate-card-viewer-ping" />
        )}
      </span>
    </span>
  )
}

function ViewerFace({
  viewer,
  labelled,
}: {
  readonly viewer: ViewerSeat
  readonly labelled: boolean
}) {
  const t = useTranslations('squads.card')

  if (viewer.kind === 'you') {
    return (
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-mint text-sm font-extrabold text-mint-ink"
      >
        {t('you')}
      </span>
    )
  }

  return (
    <Avatar
      size={44}
      playerId={viewer.id}
      name={viewer.name}
      image={viewer.image}
      label={labelled ? viewer.name : undefined}
    />
  )
}

/**
 * One of the others' circles. The avatar draws at its 36px size and shrinks to 28px below the wide
 * breakpoint, so the size follows the card without a media query in script. Each circle sits under the
 * one after it, cut out of it by a ring of the card's ground. The last circle of an open card folds on
 * hover, as the viewer's seat opens. A live arrival pops the avatar into its seat and throws the hero's
 * mint outline, which alone draws over the neighbours; the avatar stays under the next circle.
 */
function RailCircle({
  slot,
  first,
  folds,
  arrivalOrder,
}: {
  readonly slot: RailSlot
  readonly first: boolean
  readonly folds: boolean
  /** This seat's turn in a live arrival, or `null` when it is not arriving. */
  readonly arrivalOrder: number | null
}) {
  const arriving = arrivalOrder !== null
  const fillDelay = (arrivalOrder ?? 0) * ARRIVAL_STAGGER_MS

  return (
    <span
      data-rail-circle=""
      data-arriving={arriving ? '' : undefined}
      className={cn(
        'relative block size-7 shrink-0 rounded-full shadow-[0_0_0_3px_var(--color-squad-cut)] lg:size-9',
        !first && '-ml-1.5',
        folds &&
          'transition-[width,margin-left,opacity,scale] [transition-duration:350ms,350ms,200ms,300ms] ease-out card-lit:ml-0 card-lit:w-0 card-lit:scale-40 card-lit:opacity-0'
      )}
    >
      <span className="block size-9 origin-top-left scale-[0.7778] lg:scale-100">
        {arriving ? (
          <span
            className="block motion-safe:animate-card-seat-fill"
            style={{ animationDelay: `${fillDelay}ms` } satisfies CSSProperties}
          >
            <RailAvatar slot={slot} />
          </span>
        ) : (
          <RailAvatar slot={slot} />
        )}
      </span>
      {arriving && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-0.75 z-10 rounded-full border-2 border-mint opacity-0 motion-safe:animate-card-seat-ping"
          style={{ animationDelay: `${fillDelay + ARRIVAL_PING_MS}ms` } satisfies CSSProperties}
        />
      )}
    </span>
  )
}

function RailAvatar({ slot }: { readonly slot: RailSlot }) {
  switch (slot.kind) {
    case 'member':
      return (
        <Avatar
          size={36}
          playerId={slot.member.id}
          name={slot.member.name}
          image={slot.member.image}
          label={slot.member.name}
        />
      )
    case 'filled':
      return <span className="block size-9 rounded-full bg-faint" />
    case 'vacant':
      return <Avatar size={36} state="vacant" />
  }
}
