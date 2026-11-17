import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { Tag } from '@/components/ds/tag'
import { useSession } from '@/hooks/use-session'
import { languageBadgeKey } from '@/lib/language-badge'
import { lobbyHref } from '@/lib/squad-links'
import { cn } from '@/lib/utils'
import type { PublicSquad } from '@/types'
import { SquadCardCount } from './squad-card-count'
import { SquadCardRail } from './squad-card-rail'
import { useMemberArrival, type MemberArrival } from './use-member-arrival'
import {
  newlyFilledSeats,
  viewerFirstRail,
  type ViewerSeat,
  type ViewerSeatMode,
} from './viewer-first-rail'

export interface SquadCardProps {
  /** The Squad carries its own game summary, so the card never reads the catalog. */
  squad: PublicSquad
  /** Runs the join workflow for a Squad the viewer has not joined. A member's card links to the Lobby. */
  onJoin?: (squadCode: string) => void
  /** The join request is in flight, so the card ignores further clicks. */
  isLoading?: boolean
  /**
   * Draws the card as others will see it while the Squad is being created: a plain group with no
   * link, no viewer seat, no hover and no arrival, because there is nothing to open or join yet.
   */
  preview?: boolean
}

/** Tags a card names before the rest collapse into `+N`. */
const VISIBLE_TAGS = 2

/** The frame every state shares. The glow spills outside it, so the clip is on the surface inside. */
const CARD_FRAME = 'relative block w-full text-left text-text no-underline'

/**
 * What an open or member card adds: `data-lit-card` (set alongside) lights it on a fine pointer's
 * hover or on keyboard focus. It grows 2% over the cards beside it and settles a little while pressed.
 * Only keyboard focus draws the outline.
 */
const LIT_FRAME =
  CARD_FRAME +
  ' card-lit:z-10 motion-safe:transition-[scale,z-index] motion-safe:[transition-duration:280ms,350ms] motion-safe:ease-out' +
  ' motion-safe:card-lit:scale-[1.02] motion-safe:hover-fine:active:scale-[1.005] motion-safe:active:duration-100' +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint'

/**
 * The Redesign v2 Squad card (reference, Components, SquadCard). It is a link to the Lobby for a
 * member, a button that joins for an open Squad, and a disabled card for a full Squad the viewer
 * has not joined; a preview is none of these. The medium size is the default; the large one takes
 * over at wide widths, where the board lays two cards in a row.
 */
export function SquadCard({ squad, onJoin, isLoading, preview = false }: SquadCardProps) {
  const t = useTranslations()
  const session = useSession()
  const members = squad.memberCount ?? 1
  const isMember = squad.isMember === true
  const isFull = members >= squad.maxPlayers && !isMember && !preview
  const arrival = useMemberArrival(members, isMember, !preview)
  const language = t(languageBadgeKey(squad.language))
  const platform = squad.platform ? t(`platforms.${squad.platform}`) : null
  const label = t(platform ? 'squads.card.labelPlatform' : 'squads.card.label', {
    name: squad.name,
    game: squad.game.name,
    language,
    platform: platform ?? '',
    members,
    max: squad.maxPlayers,
  })

  const seat: ViewerSeatMode = preview || isFull ? 'none' : isMember ? 'seated' : 'on-hover'
  const viewer: ViewerSeat = session
    ? {
        kind: 'player',
        id: session.user.id,
        name: session.user.name,
        image: session.user.image ?? null,
      }
    : { kind: 'you' }

  const body = (
    <SquadCardSurface coverUrl={squad.game.coverUrl} lit={seat !== 'none'} isFull={isFull}>
      <SquadCardBody
        squad={squad}
        members={members}
        language={language}
        platform={platform}
        isFull={isFull}
        seat={seat}
        viewer={viewer}
        arrival={arrival}
      />
      {isFull && <FullOverlay />}
    </SquadCardSurface>
  )

  if (preview) {
    return (
      <div role="group" aria-label={label} className={CARD_FRAME}>
        {body}
      </div>
    )
  }

  if (isMember) {
    return (
      <AppLink
        href={lobbyHref(squad.code)}
        aria-label={label}
        data-lit-card=""
        className={LIT_FRAME}
      >
        <CardGlow coverUrl={squad.game.coverUrl} />
        {body}
      </AppLink>
    )
  }

  if (isFull) {
    return (
      <button
        type="button"
        aria-disabled="true"
        aria-label={label}
        className={cn(CARD_FRAME, 'cursor-not-allowed opacity-[0.62]')}
      >
        {body}
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={isLoading || undefined}
      aria-busy={isLoading || undefined}
      data-lit-card=""
      onClick={() => {
        if (!isLoading) onJoin?.(squad.code)
      }}
      className={cn(LIT_FRAME, isLoading ? 'cursor-progress' : 'cursor-pointer')}
    >
      <CardGlow coverUrl={squad.game.coverUrl} />
      {body}
    </button>
  )
}

/** A cover as a CSS background. A cover that fails to load simply draws nothing over the ground. */
function coverBackground(coverUrl: string): CSSProperties {
  return { backgroundImage: `url(${JSON.stringify(coverUrl)})` }
}

/**
 * The game's colour spilling under a lit card: a second blurred copy of the cover behind the card,
 * outside its clip. It rises into view as the card lights.
 */
function CardGlow({ coverUrl }: { readonly coverUrl: string }) {
  return (
    <span
      aria-hidden="true"
      data-card-glow=""
      className={cn(
        'pointer-events-none absolute inset-[24px_28px_-4px] z-0 scale-92 bg-cover bg-center opacity-0 blur-[28px] saturate-[1.8]',
        'transition-[opacity,translate,scale] [transition-duration:300ms,350ms,350ms] ease-out',
        'card-lit:translate-y-3.5 card-lit:scale-100 card-lit:opacity-60'
      )}
      style={coverBackground(coverUrl)}
    />
  )
}

/**
 * The card's surface: the game's colour as its ground (the cover, blurred and overflowing, under a
 * shade that keeps the text readable), clipped to the card. The cover is the poster's own URL, so it
 * costs no extra request. A full card's ground goes grey with its poster.
 */
function SquadCardSurface({
  coverUrl,
  lit,
  isFull,
  children,
}: {
  readonly coverUrl: string
  /** An open or member card: it casts a shadow and brightens its ground when lit. */
  readonly lit: boolean
  readonly isFull: boolean
  readonly children: ReactNode
}) {
  // The blurred cover overflows the card by 30% on each side and clips itself to the card's edge
  // (30% of a 160% box is 18.75%). The card's own clip is not enough once the card scales on hover:
  // Chrome draws the composited blur a fraction of a pixel past the shade there, as a bright line.
  return (
    <span
      className={cn(
        'relative z-1 isolate grid min-h-44 grid-cols-[118px_minmax(0,1fr)] overflow-hidden bg-squad-ground',
        'lg:min-h-53.5 lg:grid-cols-[160px_minmax(0,1fr)]',
        lit && 'transition-shadow duration-300 card-lit:shadow-[0_20px_40px_-18px_rgba(0,0,0,0.85)]'
      )}
    >
      <span
        aria-hidden="true"
        data-card-ground=""
        className={cn(
          'pointer-events-none absolute -inset-[30%] -z-2 bg-cover bg-center blur-[34px] saturate-[1.6] [clip-path:inset(18.75%)]',
          isFull ? 'opacity-35 grayscale' : 'opacity-68',
          lit && 'transition-opacity duration-350 card-lit:opacity-88'
        )}
        style={coverBackground(coverUrl)}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-1 squad-card-shade"
      />
      {children}
    </span>
  )
}

/**
 * The poster is the one place the card names its game. A cover that fails leaves the ground, rather
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
        'motion-safe:transition-transform motion-safe:duration-450 motion-safe:ease-out',
        isFull ? 'grayscale' : 'motion-safe:card-lit:scale-[1.04]'
      )}
    />
  )
}

/** The poster and the info column, which every state of the card shares. */
function SquadCardBody({
  squad,
  members,
  language,
  platform,
  isFull,
  seat,
  viewer,
  arrival,
}: {
  readonly squad: PublicSquad
  readonly members: number
  readonly language: string
  /** The translated platform label, or `null` for a Squad without a platform. */
  readonly platform: string | null
  /** A full Squad the viewer has not joined: grayscale, with no hover. */
  readonly isFull: boolean
  readonly seat: ViewerSeatMode
  /** Who sits in the viewer's seat: the signed-in player, or "you". */
  readonly viewer: ViewerSeat
  readonly arrival: MemberArrival | null
}) {
  const tags = squad.tags ?? []
  const railViewer = seat === 'seated' ? viewer : null
  const rail = viewerFirstRail(members, squad.maxPlayers, squad.memberPreview, railViewer)
  const arriving = arrival
    ? newlyFilledSeats(
        viewerFirstRail(arrival.from, squad.maxPlayers, squad.memberPreview, railViewer).slots,
        rail.slots
      )
    : []

  return (
    <>
      <span className="relative z-1 block overflow-hidden bg-raised-2">
        <Poster src={squad.game.coverUrl} alt={squad.game.name} isFull={isFull} />
      </span>

      <span className="relative z-2 flex min-w-0 flex-col gap-2 px-4 py-3.5 lg:gap-2.5 lg:px-5.5 lg:py-4.5">
        <span className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Tag variant="lang-glass" label={language} />
            {squad.platform && platform && (
              <Tag variant="platform-glass" platform={squad.platform} label={platform} />
            )}
          </span>
          <span className="type-code shrink-0 text-faint">#{squad.code}</span>
        </span>

        <span className="line-clamp-2 font-hero text-[22px] leading-[1.04] tracking-[0.006em] wrap-break-word uppercase lg:text-[28px]">
          {squad.name}
        </span>

        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {tags.slice(0, VISIBLE_TAGS).map((tag) => (
            <Tag key={tag} variant="glass" label={tag} />
          ))}
          {tags.length > VISIBLE_TAGS && (
            <span className="px-0.5 py-1 text-xs font-semibold text-muted">
              +{tags.length - VISIBLE_TAGS}
            </span>
          )}
        </span>

        <span className="grow" />

        <span className="flex items-center justify-between gap-2.5">
          <SquadCardRail
            rail={rail}
            seat={seat}
            hoverViewer={seat === 'on-hover' ? viewer : null}
            arriving={arriving}
            arrivalId={arrival?.id ?? null}
          />
          <SquadCardCount
            key={arrival?.id ?? 0}
            members={members}
            max={squad.maxPlayers}
            from={arrival?.from ?? members}
            mint={seat === 'seated'}
            rollsOnHover={seat === 'on-hover'}
            muted={isFull}
          />
        </span>
      </span>
    </>
  )
}

function FullOverlay() {
  const t = useTranslations('squads.card')

  return (
    <span className="absolute inset-y-0 left-0 z-3 flex w-29.5 items-center justify-center bg-bg/55 lg:w-40">
      <span className="font-hero text-2xl tracking-[0.12em] text-text uppercase">{t('full')}</span>
    </span>
  )
}
