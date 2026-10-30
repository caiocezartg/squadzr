import { useCallback, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { Avatar } from '@/components/ds/avatar'
import { Tag } from '@/components/ds/tag'
import { languageBadgeKey } from '@/lib/language-badge'
import { lobbyHref } from '@/lib/squad-links'
import { cn } from '@/lib/utils'
import type { PublicSquad } from '@/types'
import { avatarRail, type RailSlot } from './avatar-rail'
import { useFittingCircles } from './use-fitting-circles'

export interface SquadCardProps {
  /** The Squad carries its own game summary, so the card never reads the catalog. */
  squad: PublicSquad
  /** Runs the join workflow for a Squad the viewer has not joined. A member's card links to the Lobby. */
  onJoin?: (squadCode: string) => void
  /** The join request is in flight, so the card ignores further clicks. */
  isLoading?: boolean
  /**
   * Draws the card as others will see it while the Squad is being created: a plain group with no
   * link, no join call to action and no hover, because there is nothing to open or join yet.
   */
  preview?: boolean
}

/** Tags a card names before the rest collapse into `+N`. */
const VISIBLE_TAGS = 2

const CARD_LAYOUT =
  'relative grid w-full min-h-44 grid-cols-[118px_minmax(0,1fr)] overflow-hidden bg-card ' +
  'text-left text-text no-underline lg:min-h-53.5 lg:grid-cols-[160px_minmax(0,1fr)]'

/** What the three interactive states add: the `group` the hover effects hang on, and the focus ring. */
const CARD_CLASSES =
  CARD_LAYOUT +
  ' group transition-colors duration-200 hover-fine:bg-raised ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint'

/**
 * The Redesign v2 Squad card (reference, Components, SquadCard). It is a link to the Lobby for a
 * member, a button that joins for an open Squad, and a disabled card for a full Squad the viewer
 * has not joined; a preview is none of these. The medium size is the default; the large one takes over at wide widths, where
 * the board lays two cards in a row.
 */
export function SquadCard({ squad, onJoin, isLoading, preview = false }: SquadCardProps) {
  const t = useTranslations()
  const members = squad.memberCount ?? 1
  const isMember = squad.isMember === true
  const isFull = members >= squad.maxPlayers && !isMember && !preview
  const language = t(languageBadgeKey(squad.language))
  const label = t('squads.card.label', {
    name: squad.name,
    game: squad.game.name,
    language,
    members,
    max: squad.maxPlayers,
  })

  const body = <SquadCardBody squad={squad} members={members} language={language} isFull={isFull} />

  if (preview) {
    return (
      <div role="group" aria-label={label} className={CARD_LAYOUT}>
        {body}
      </div>
    )
  }

  if (isMember) {
    return (
      <AppLink href={lobbyHref(squad.code)} aria-label={label} className={CARD_CLASSES}>
        <CardRing />
        {body}
        <JoinedBadge />
        <HoverCta label={t('squads.card.openRoom')} />
      </AppLink>
    )
  }

  if (isFull) {
    return (
      <button
        type="button"
        aria-disabled="true"
        aria-label={label}
        className={cn(CARD_CLASSES, 'cursor-not-allowed opacity-[0.62] hover-fine:bg-card')}
      >
        {body}
        <FullOverlay />
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={isLoading || undefined}
      aria-busy={isLoading || undefined}
      onClick={() => {
        if (!isLoading) onJoin?.(squad.code)
      }}
      className={cn(CARD_CLASSES, isLoading ? 'cursor-progress' : 'cursor-pointer')}
    >
      <CardRing />
      {body}
      <HoverCta label={t('squads.card.enter')} />
    </button>
  )
}

/**
 * The poster is the one place the card shows its game. A cover that fails leaves the ground, rather
 * than the browser's broken-image alt text. A failed URL is remembered by value, so a different cover
 * gets its own try.
 */
function Poster({
  src,
  alt,
  isFull,
}: {
  readonly src: string
  readonly alt: string
  readonly isFull: boolean
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  // The server HTML starts the image loading before React attaches `onError`, and an image that
  // already failed by then never fires it again, so the ref checks the image once it is attached.
  const checkAttachedImage = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth === 0) setFailedSrc(src)
    },
    [src]
  )

  if (src === failedSrc) return null

  return (
    <img
      ref={checkAttachedImage}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={cn(
        'absolute inset-0 block size-full object-cover',
        'motion-safe:transition-transform motion-safe:duration-400 motion-safe:ease-out',
        isFull ? 'grayscale' : 'motion-safe:group-hover-fine:scale-[1.03]'
      )}
    />
  )
}

/** The poster and the info column, which every state of the card shares. */
function SquadCardBody({
  squad,
  members,
  language,
  isFull,
}: {
  readonly squad: PublicSquad
  readonly members: number
  readonly language: string
  /** A full Squad the viewer has not joined: grayscale, with no hover. */
  readonly isFull: boolean
}) {
  const tags = squad.tags ?? []
  const rail = avatarRail(members, squad.maxPlayers, squad.memberPreview)
  const { railRef, shown } = useFittingCircles(rail.slots.length, rail.extra > 0)
  // The circles that do not fit join the slots past the rail in the `+N`.
  const extra = rail.extra + (rail.slots.length - shown)

  return (
    <>
      <span className="relative block overflow-hidden bg-raised-2">
        <Poster src={squad.game.coverUrl} alt={squad.game.name} isFull={isFull} />
      </span>

      <span className="relative flex min-w-0 flex-col gap-2 px-4 py-3.5 lg:gap-2.5 lg:px-5.5 lg:py-4.5">
        <span className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
          <Tag variant="lang" label={language} />
          <span className="type-code shrink-0 text-faint">#{squad.code}</span>
        </span>

        <span className="type-squad-name-md line-clamp-2 wrap-break-word lg:type-squad-name">
          {squad.name}
        </span>

        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {tags.slice(0, VISIBLE_TAGS).map((tag) => (
            <Tag key={tag} variant="tag" label={tag} />
          ))}
          {tags.length > VISIBLE_TAGS && (
            <span className="px-0.5 py-1 text-xs font-semibold text-muted">
              +{tags.length - VISIBLE_TAGS}
            </span>
          )}
        </span>

        <span className="grow" />

        <span className="flex items-center justify-between gap-2.5">
          <span
            ref={railRef}
            className="flex min-w-0 flex-1 items-center overflow-hidden py-0.5 pr-0.5"
          >
            {rail.slots.slice(0, shown).map((slot, index) => (
              <RailCircle key={index} slot={slot} first={index === 0} lit={!isFull} />
            ))}
            {extra > 0 && (
              <span className="ml-3.5 shrink-0 font-ds-mono text-xs font-bold text-text-3">
                +{extra}
              </span>
            )}
          </span>
          <span
            className={cn(
              'shrink-0 font-display text-xl leading-none font-extrabold tabular-nums lg:text-2xl',
              'transition-opacity duration-200',
              !isFull && 'group-hover-fine:opacity-0'
            )}
          >
            <span className={isFull ? 'text-text-3' : 'text-text'}>{members}</span>
            <span className="text-faint">/{squad.maxPlayers}</span>
          </span>
        </span>
      </span>
    </>
  )
}

/**
 * One circle of the rail. The avatar draws at its 34px size and shrinks to 28px below the wide
 * breakpoint, so the size follows the card without a media query in script. The ring cuts the circle
 * out of its neighbour and follows the card's ground when it lights on hover.
 */
function RailCircle({
  slot,
  first,
  lit,
}: {
  readonly slot: RailSlot
  readonly first: boolean
  /** The ring follows the card's ground on hover; a full card never lights. */
  readonly lit: boolean
}) {
  return (
    <span
      data-rail-circle=""
      className={cn(
        'relative block size-7 shrink-0 rounded-full ring-2 ring-card lg:size-8.5',
        'transition-shadow duration-200',
        lit && 'group-hover-fine:ring-raised',
        !first && '-ml-1.5'
      )}
    >
      <span className="block size-8.5 origin-top-left scale-[0.8235] lg:scale-100">
        <RailAvatar slot={slot} />
      </span>
    </span>
  )
}

function RailAvatar({ slot }: { readonly slot: RailSlot }) {
  switch (slot.kind) {
    case 'member':
      return (
        <Avatar
          size={34}
          playerId={slot.member.id}
          name={slot.member.name}
          image={slot.member.image}
          label={slot.member.name}
        />
      )
    case 'filled':
      return <span className="block size-8.5 rounded-full bg-faint" />
    case 'vacant':
      return <Avatar size={34} state="vacant" />
  }
}

/** The 1.5px mint ring of the hover, drawn over the poster and fading with the ground. */
function CardRing() {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 z-10 opacity-0 shadow-[inset_0_0_0_1.5px_var(--color-mint)]',
        'transition-opacity duration-200 group-hover-fine:opacity-100'
      )}
    />
  )
}

function JoinedBadge() {
  const t = useTranslations('squads.card')

  return (
    <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-mint px-1.5 py-1 font-ds-mono text-[9.5px] font-bold tracking-[0.08em] text-mint-ink uppercase">
      <Check aria-hidden="true" className="size-2.5 stroke-[3.5]" />
      {t('joined')}
    </span>
  )
}

function FullOverlay() {
  const t = useTranslations('squads.card')

  return (
    <span className="absolute inset-y-0 left-0 flex w-29.5 items-center justify-center bg-bg/55 lg:w-40">
      <span className="font-display text-2xl font-black tracking-[0.12em] text-text uppercase">
        {t('full')}
      </span>
    </span>
  )
}

/** The call to action that slides in over the count on hover. It repeats what the card's name says. */
function HoverCta({ label }: { readonly label: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute right-4 bottom-3 z-20 inline-flex h-8.5 items-center gap-1.75 bg-mint px-3 text-[13px] font-extrabold text-mint-ink opacity-0 lg:right-5.5 lg:bottom-4',
        'transition-[opacity,translate] [transition-duration:200ms,250ms] ease-out',
        'motion-safe:translate-x-2.5 motion-safe:group-hover-fine:translate-x-0',
        'group-hover-fine:opacity-100'
      )}
    >
      {label}
      <ArrowRight className="size-3.25 stroke-[2.8]" />
    </span>
  )
}
