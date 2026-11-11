'use client'

import { ExternalLink, Lock, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SlotMeter } from '@/components/ds/slot-meter'
import { DiscordIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { Seat, type MockupProps } from './how-it-works-mockup-parts'
import { useMockupTimeline } from './use-mockup-timeline'

/**
 * 1 the fourth member joins · 2 the fifth closes the team · 3 the Squad is complete and the panel lights
 * up · 4 the Discord invite unlocks.
 */
const CLOSE_CUES = [600, 1300, 1700, 1950] as const

interface Member {
  readonly id: string
  readonly name: string
  readonly host?: boolean
  readonly you?: boolean
}

/** Who is in when step 3 opens: the host, a friend, and the visitor, who joined in step 2. */
const FOUNDERS: readonly Member[] = [
  { id: 'mf-7', name: 'mia.f', host: true },
  { id: 'br-0', name: 'brunão' },
  { id: 'cc-2', name: 'caio_cz', you: true },
]

/** The two who close the team, in order. */
const CLOSERS: readonly Member[] = [
  { id: 'kz-4', name: 'kz_dex' },
  { id: 'lu-4', name: 'luiza' },
]

const SQUAD_SIZE = FOUNDERS.length + CLOSERS.length

/** The Lobby's online member tile ground (reference, MemberTile), which the host crown's ring blends into. */
const TILE_GROUND = '#15161a'

interface MemberCellProps {
  readonly member: Member | null
  /** The member arrives in front of the visitor: the join plays on them. */
  readonly arriving: boolean
}

/** A compact member tile of the Lobby: a member in the room, or an open slot. */
function MemberCell({ member, arriving }: MemberCellProps) {
  const t = useTranslations('ds.member')

  return (
    <li
      className={cn(
        'flex h-10 min-w-0 items-center gap-2 px-2 transition-[background-color,box-shadow] duration-200 ease-(--ease-out)',
        member ? 'bg-[#15161a]' : 'bg-[#0c0d10] shadow-[inset_0_0_0_1px_#1a1b20]'
      )}
    >
      {member ? (
        <>
          <Seat
            id={member.id}
            name={member.name}
            host={member.host}
            surface={TILE_GROUND}
            arriving={arriving}
          />
          <span
            className={cn(
              'text-text min-w-0 flex-1 truncate text-[12.5px] font-bold',
              arriving && 'motion-safe:animate-count-in'
            )}
          >
            {member.name}
          </span>
          {member.you && <span className="text-muted shrink-0 text-[10.5px]">{t('you')}</span>}
        </>
      ) : (
        <>
          <span className="bg-raised-2 text-muted flex size-7 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1.5px_#34353c]">
            <Plus className="size-3" strokeWidth={2.6} />
          </span>
          <span className="text-text-2 min-w-0 flex-1 truncate text-[12.5px] font-bold">
            {t('openSlot')}
          </span>
        </>
      )}
    </li>
  )
}

/**
 * The Lobby's Discord invite at the mockup's size: locked while the Squad forms, then the "Bora pro
 * Discord" banner, which enters as the Lobby's does and sweeps its sheen once.
 */
function InviteBanner({ ready, live }: { readonly ready: boolean; readonly live: boolean }) {
  const t = useTranslations('ds.invite')

  return (
    <span className="relative block h-19.5">
      <span
        data-gone={ready ? '' : undefined}
        className="bg-panel absolute inset-0 flex flex-col justify-center gap-2 px-3 transition-opacity duration-150 ease-(--ease-out) data-gone:opacity-0"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="bg-raised text-discord-soft flex size-7 shrink-0 items-center justify-center rounded-lg">
            <Lock className="size-3.5" strokeWidth={2.4} />
          </span>
          <span className="text-text-3 truncate text-[11.5px] font-semibold">
            {t('lockedBody')}
          </span>
        </span>
        <span className="font-mono text-[11.5px] font-bold text-[#4a4c54]">
          discord.gg/••••••••
        </span>
      </span>
      <span
        data-shown={ready ? '' : undefined}
        className="bg-discord absolute inset-0 flex translate-y-3.5 scale-[0.99] flex-col justify-center gap-2 overflow-hidden px-3 text-white opacity-0 transition-[opacity,translate,scale] duration-500 ease-(--ease-out) data-shown:translate-y-0 data-shown:scale-100 data-shown:opacity-100"
      >
        <DiscordIcon
          aria-hidden="true"
          className="absolute -right-4 -bottom-7 size-24 text-white opacity-14"
        />
        {live && ready && (
          <span
            aria-hidden="true"
            className="motion-safe:animate-invite-sheen absolute inset-y-0 left-0 hidden w-[24%] bg-linear-to-r from-white/0 via-white/14 to-white/0 motion-safe:block"
          />
        )}
        <span className="font-display relative text-[20px] leading-none font-black uppercase">
          {t('title')}
        </span>
        <span className="relative flex min-w-0 items-center gap-2">
          <span className="font-mono min-w-0 flex-1 truncate text-[11.5px] font-bold">
            <span className="text-white/60">discord.gg/</span>premier5
          </span>
          <span className="flex shrink-0 items-center gap-1 bg-white px-2 py-1.25 text-[10.5px] font-extrabold text-[#2b33a8]">
            {t('open')}
            <ExternalLink className="size-2.75" strokeWidth={2.8} />
          </span>
        </span>
      </span>
    </span>
  )
}

export function CloseTeamMockup({ mode }: MockupProps) {
  const t = useTranslations('landing.howItWorks')
  const { beat, live } = useMockupTimeline(CLOSE_CUES, mode)
  const joined = Math.min(CLOSERS.length, beat)
  const filled = FOUNDERS.length + joined
  const complete = beat >= 3

  return (
    <div className="bg-card relative flex size-full flex-col gap-2.5 overflow-hidden p-3">
      <span
        data-complete={complete ? '' : undefined}
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_transparent] transition-shadow duration-300 ease-(--ease-out) data-complete:shadow-[inset_0_0_0_1.5px_rgba(0,255,162,0.55)]"
      />
      <span className="flex items-baseline justify-between">
        <span
          className={cn(
            'font-mono text-[10px] font-bold tracking-[0.14em] uppercase transition-colors duration-200',
            complete ? 'text-mint' : 'text-text-3'
          )}
        >
          {complete ? t('mockup.complete') : t('mockup.members')}
        </span>
        <span
          className={cn(
            'font-display text-[20px] leading-none font-black tabular-nums transition-colors duration-200',
            complete ? 'text-mint' : 'text-text'
          )}
        >
          <span key={filled} className={cn('inline-block', live && 'motion-safe:animate-count-in')}>
            {filled}
          </span>
          /{SQUAD_SIZE}
        </span>
      </span>
      <SlotMeter filled={filled} total={SQUAD_SIZE} variant="line" />
      <ul className="grid grid-cols-2 gap-1.5">
        {FOUNDERS.map((member) => (
          <MemberCell key={member.id} member={member} arriving={false} />
        ))}
        {CLOSERS.map((member, index) => (
          <MemberCell
            key={member.id}
            member={index < joined ? member : null}
            arriving={live && index < joined}
          />
        ))}
      </ul>
      <span className="mt-auto block">
        <InviteBanner ready={beat >= 4} live={live} />
      </span>
    </div>
  )
}
