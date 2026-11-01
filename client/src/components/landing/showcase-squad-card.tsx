'use client'

import * as m from 'motion/react-m'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { Tag } from '@/components/ds/tag'
import { languageBadgeKey } from '@/lib/language-badge'
import { cn } from '@/lib/utils'
import { coverUrl, squadSize, type ShowcaseMember, type ShowcaseSquad } from './hero-showcase-data'

interface SeatProps {
  readonly member: ShowcaseMember | undefined
  /** The member joined under the script: the avatar pops in and its ring flashes once. */
  readonly entering: boolean
  /** The first empty seat, the one the next player takes: its ring waits, dashed. */
  readonly next: boolean
  readonly host: boolean
}

/** One seat of the card's rail: a member's avatar, or an empty circle. */
function Seat({ member, entering, next, host }: SeatProps) {
  if (!member) {
    return (
      <span className="relative block size-7 sm:size-9">
        <span className="block origin-top-left scale-[0.6364] sm:scale-[0.8182]">
          <Avatar size={44} state="vacant" />
        </span>
        {next && (
          <span
            aria-hidden="true"
            className="border-mint/60 motion-safe:animate-seat-wait absolute -inset-1 rounded-full border border-dashed"
          />
        )}
      </span>
    )
  }

  return (
    <m.span
      className="relative block size-7 sm:size-9"
      initial={entering ? { opacity: 0, transform: 'scale(0.4)' } : false}
      animate={{ opacity: 1, transform: 'scale(1)' }}
      transition={{ type: 'spring', duration: 0.45, bounce: 0.35 }}
    >
      <span className="block origin-top-left scale-[0.6364] sm:scale-[0.8182]">
        <Avatar size={44} playerId={member.id} name={member.name} host={host} />
      </span>
      {entering && (
        <span
          aria-hidden="true"
          className="border-mint motion-safe:animate-seat-ping absolute -inset-0.5 rounded-full border-2 opacity-0"
        />
      )}
    </m.span>
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
 * A squad of the hero carousel, drawn in the board card's language: the game's cover as its poster, the
 * language and code, the name and tags, and the rail of seats with the count. Its seats fill as players
 * join; once the last one does, the card says so without doubt: its edge and glow turn mint, the poster
 * takes a "full" stamp, the count turns mint and the status reads that the squad is complete.
 */
export function ShowcaseSquadCard({ squad, filled, centered, scripted }: ShowcaseSquadCardProps) {
  const t = useTranslations()
  const total = squadSize(squad)
  const complete = filled >= total
  const missing = total - filled
  const lastJoined =
    scripted && centered && filled > squad.founders ? squad.members[filled - 1] : undefined

  return (
    <div
      data-complete={complete ? '' : undefined}
      className={cn(
        'group/card bg-card relative grid h-full text-left grid-cols-[104px_minmax(0,1fr)] overflow-hidden sm:grid-cols-[136px_minmax(0,1fr)]',
        'transition-shadow duration-500 ease-out',
        complete &&
          centered &&
          'shadow-[0_0_0_1.5px_var(--color-mint),0_24px_80px_-24px_rgba(0,255,162,0.45)]',
        !(complete && centered) &&
          'shadow-[0_0_0_1px_var(--color-line),0_24px_60px_-30px_rgba(0,0,0,0.9)]'
      )}
    >
      {/* The bar along the top fills as the squad does. */}
      <span aria-hidden="true" className="bg-track absolute inset-x-0 top-0 z-10 h-0.5">
        <span
          className="bg-mint absolute inset-0 origin-left transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${filled / total})` }}
        />
      </span>

      <span className="bg-raised-2 relative block overflow-hidden">
        <img
          src={coverUrl(squad.coverId)}
          alt=""
          decoding="async"
          className={cn(
            'absolute inset-0 block size-full object-cover transition-transform duration-700 ease-out',
            complete && centered && 'motion-safe:scale-[1.04]'
          )}
        />
        {complete && centered && (
          <span
            aria-hidden="true"
            className="bg-bg/55 absolute inset-0 flex items-center justify-center"
          >
            <span
              className={cn(
                'bg-mint text-mint-ink font-display flex items-center gap-1 px-2 py-1 text-base leading-none font-black tracking-[0.08em] uppercase sm:text-lg',
                scripted && 'motion-safe:animate-card-stamp'
              )}
            >
              <Check className="size-4 stroke-[3.5]" />
              {t('landing.showcase.full')}
            </span>
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-col gap-2 px-4 py-3.5 sm:gap-2.5 sm:px-5 sm:py-4.5">
        <span className="flex items-center justify-between gap-2">
          <Tag variant="lang" label={t(languageBadgeKey(squad.language))} />
          <span className="type-code text-faint shrink-0">#{squad.code}</span>
        </span>

        <span className="min-w-0">
          <span className="type-label text-ds-muted block truncate">{squad.game}</span>
          <span className="type-squad-name-md line-clamp-1 wrap-break-word sm:line-clamp-2">
            {squad.name}
          </span>
        </span>

        <span className="flex min-w-0 flex-wrap items-center gap-1.5 max-sm:hidden">
          {squad.tags.map((tag) => (
            <Tag key={tag} variant="tag" label={tag} />
          ))}
        </span>

        <span className="grow" />

        <span className="flex items-end justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            {Array.from({ length: total }, (_, index) => {
              const member = index < filled ? squad.members[index] : undefined
              return (
                <Seat
                  key={index}
                  member={member}
                  host={index === 0}
                  next={centered && !complete && index === filled}
                  entering={scripted && centered && index >= squad.founders && index < filled}
                />
              )
            })}
          </span>
          <span
            className={cn(
              'font-display flex shrink-0 text-2xl leading-none font-extrabold tabular-nums transition-colors duration-300 sm:text-3xl',
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

        <span className="font-ds-mono relative h-4 text-[11px] leading-4 font-bold tracking-[0.12em] uppercase">
          {complete ? (
            <span
              key="complete"
              className={cn(
                'text-mint flex items-center gap-1.5',
                scripted && centered && 'motion-safe:animate-count-in'
              )}
            >
              <span className="bg-mint size-1.5 rounded-full shadow-[0_0_10px_var(--color-mint)]" />
              {t('landing.showcase.complete')}
            </span>
          ) : (
            <span key={filled} className="text-ds-muted flex min-w-0 items-center gap-1.5">
              {lastJoined && (
                <span className="text-text-2 motion-safe:animate-count-in truncate normal-case max-sm:hidden">
                  {t('landing.showcase.joined', { name: lastJoined.name })}
                  <span className="text-faint px-1.5">·</span>
                </span>
              )}
              <span className="shrink-0">{t('landing.showcase.missing', { count: missing })}</span>
            </span>
          )}
        </span>
      </span>
    </div>
  )
}
