'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { Tag } from '@/components/ds/tag'
import { languageBadgeKey } from '@/lib/language-badge'
import { cn } from '@/lib/utils'
import { coverUrl, squadSize, type ShowcaseMember, type ShowcaseSquad } from './hero-showcase-data'

interface SeatProps {
  readonly member: ShowcaseMember | undefined
  /**
   * The member joined under the script: a mint disc pops over the seat and fades to show the avatar, and
   * a ring flashes once. The avatar itself only shows, in one step, once the disc covers it. Scaling it would have its initials snap to the
   * pixel grid as the animation ends, so nothing that holds text is ever scaled.
   */
  readonly entering: boolean
  readonly first: boolean
}

/**
 * One circle of the card's rail, drawn like the board card's: 34px, 28px below the wide breakpoint, its
 * ring cutting it out of its neighbour. A member's avatar, or an empty circle.
 */
function Seat({ member, entering, first }: SeatProps) {
  const frame = cn(
    'relative block size-7 shrink-0 rounded-full ring-2 ring-card lg:size-8.5',
    !first && '-ml-1.5'
  )
  const scaled = 'block size-8.5 origin-top-left scale-[0.8235] lg:scale-100'

  if (!member) {
    return (
      <span className={frame}>
        <span className={scaled}>
          <Avatar size={34} state="vacant" />
        </span>
      </span>
    )
  }

  return (
    <span className={frame}>
      <span className={cn(scaled, entering && 'motion-safe:animate-seat-in')}>
        <Avatar size={34} playerId={member.id} name={member.name} />
      </span>
      {entering && (
        <>
          <span
            aria-hidden="true"
            className="bg-mint motion-safe:animate-seat-burst absolute inset-0 rounded-full opacity-0"
          />
          <span
            aria-hidden="true"
            className="border-mint motion-safe:animate-seat-ping absolute -inset-0.5 rounded-full border-2 opacity-0"
          />
        </>
      )}
    </span>
  )
}

interface ShowcaseSquadCardProps {
  readonly squad: ShowcaseSquad
  readonly filled: number
  /** The card is in the centre of the carousel. Only there do joins and the full state play. */
  readonly centered: boolean
  /** Members who join from now on enter with their motion. */
  readonly scripted: boolean
}

/**
 * A squad of the hero carousel, drawn as the board's squad card draws it: the game's cover as a 3:4
 * poster, the language and code, the name and tags, and the rail of members with the count. Its rail
 * fills as players join; once the last one does, the card says so: its edge turns mint with a soft glow,
 * the poster takes a "full" stamp and the count turns mint.
 */
export function ShowcaseSquadCard({ squad, filled, centered, scripted }: ShowcaseSquadCardProps) {
  const t = useTranslations()
  const total = squadSize(squad)
  const complete = filled >= total
  const lit = complete && centered

  return (
    <div
      data-complete={complete ? '' : undefined}
      className={cn(
        // The board card's large size, with the height its 3:4 poster takes: 132×176, and 160×213.5 from 1024px.
        'bg-card relative grid h-44 w-full grid-cols-[132px_minmax(0,1fr)] overflow-hidden text-left lg:h-53.5 lg:grid-cols-[160px_minmax(0,1fr)]',
        'transition-shadow duration-500 ease-out',
        lit
          ? 'shadow-[0_0_0_1.5px_var(--color-mint),0_0_36px_-8px_rgba(0,255,162,0.35)]'
          : 'shadow-[0_0_0_1px_var(--color-line)]'
      )}
    >
      <span className="bg-raised-2 relative block overflow-hidden">
        <img
          src={coverUrl(squad.coverId)}
          alt=""
          decoding="async"
          className="absolute inset-0 block size-full object-cover"
        />
        {lit && (
          <span
            aria-hidden="true"
            className="bg-bg/55 absolute inset-0 flex items-center justify-center"
          >
            <span
              className={cn(
                'bg-mint text-mint-ink font-display flex items-center gap-1 px-2 py-1 text-base leading-none font-black tracking-[0.08em] uppercase',
                scripted && 'motion-safe:animate-card-stamp'
              )}
            >
              <Check className="size-4 stroke-[3.5]" />
              {t('landing.showcase.full')}
            </span>
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-col gap-2 px-4 py-3.5 lg:gap-2.5 lg:px-5.5 lg:py-4.5">
        <span className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
          <Tag variant="lang" label={t(languageBadgeKey(squad.language))} />
          <span className="type-code text-faint shrink-0">#{squad.code}</span>
        </span>

        <span className="type-squad-name-md lg:type-squad-name truncate">{squad.name}</span>

        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {squad.tags.map((tag) => (
            <Tag key={tag} variant="tag" label={tag} />
          ))}
        </span>

        <span className="grow" />

        <span className="flex items-center justify-between gap-2.5">
          <span className="flex min-w-0 flex-1 items-center py-0.5 pr-0.5">
            {Array.from({ length: total }, (_, index) => (
              <Seat
                // A seat that takes its member mounts anew, so its entrance plays from its start.
                key={`${index}-${index < filled ? 'member' : 'vacant'}`}
                first={index === 0}
                member={index < filled ? squad.members[index] : undefined}
                entering={scripted && centered && index >= squad.founders && index < filled}
              />
            ))}
          </span>
          <span
            className={cn(
              'font-display flex shrink-0 text-xl leading-none font-extrabold tabular-nums transition-colors duration-300 lg:text-2xl',
              complete ? 'text-mint' : 'text-text'
            )}
          >
            <span
              key={filled}
              className={cn('inline-block', scripted && centered && 'motion-safe:animate-count-in')}
            >
              {filled}
            </span>
            <span className="text-faint">/{total}</span>
          </span>
        </span>
      </span>
    </div>
  )
}
