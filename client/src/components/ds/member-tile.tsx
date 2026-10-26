import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'
import { Avatar, type AvatarState } from './avatar'

interface OpenSlotProps {
  readonly open: true
}

interface PlayerProps {
  readonly open?: false
  readonly playerId: string
  readonly name: string
  /** The player's Discord image. */
  readonly image?: string | null
  readonly host?: boolean
  /** The viewer's own row reads "you". */
  readonly you?: boolean
  /** In the room now; otherwise out of it. */
  readonly online: boolean
  /** ISO time the player left the room. Without it an away player reads "Out of the room". */
  readonly offlineSince?: string | null
}

export type MemberTileProps = OpenSlotProps | PlayerProps

interface TileLook {
  readonly ground: string
  /** The ground as a colour, which the host crown's ring blends into. */
  readonly groundColor: string
  readonly name: string
  readonly avatar: AvatarState
}

const ONLINE_LOOK: TileLook = {
  ground: 'bg-[#15161a]',
  groundColor: '#15161a',
  name: 'text-text',
  avatar: 'online',
}
const AWAY_LOOK: TileLook = {
  ground: 'bg-[#111215]',
  groundColor: '#111215',
  name: 'text-text-3',
  avatar: 'away',
}
const OPEN_LOOK: TileLook = {
  ground: 'bg-[#0c0d10] shadow-[inset_0_0_0_1px_#1a1b20]',
  groundColor: '#0c0d10',
  name: 'text-text-2',
  avatar: 'open',
}

/**
 * A member of the Squad, or an open slot, as a row of the members list (reference, Components). It is
 * a list item, so the parent is a `ul` or `ol`. The presence is text for assistive technology and the
 * row's tooltip, never colour alone.
 */
export function MemberTile(props: MemberTileProps) {
  const t = useTranslations('ds.member')
  const timeAgo = useTimeAgo(props.open ? undefined : (props.offlineSince ?? undefined))

  if (props.open) {
    return (
      <Tile look={OPEN_LOOK} presence={t('presence.open')}>
        <Avatar state="open" surface={OPEN_LOOK.groundColor} />
        <Name look={OPEN_LOOK}>{t('openSlot')}</Name>
      </Tile>
    )
  }

  const look = props.online ? ONLINE_LOOK : AWAY_LOOK
  const presence = props.online
    ? t('presence.online')
    : timeAgo
      ? t('presence.awaySince', { time: timeAgo })
      : t('presence.away')

  return (
    <Tile look={look} presence={presence}>
      <Avatar
        state={look.avatar}
        playerId={props.playerId}
        name={props.name}
        image={props.image}
        host={props.host}
        surface={look.groundColor}
      />
      <Name look={look}>{props.name}</Name>
      {props.you && <span className="shrink-0 text-xs text-ds-muted">{t('you')}</span>}
    </Tile>
  )
}

function Tile({
  look,
  presence,
  children,
}: {
  readonly look: TileLook
  readonly presence: string
  readonly children: ReactNode
}) {
  return (
    <li
      title={presence}
      className={cn('flex min-h-16 items-center gap-3.5 py-2.5 pr-3.5 pl-3 text-text', look.ground)}
    >
      {children}
      <span className="sr-only">{presence}</span>
    </li>
  )
}

function Name({ look, children }: { readonly look: TileLook; readonly children: ReactNode }) {
  return (
    <span className={cn('min-w-0 flex-1 truncate text-[15px] font-bold', look.name)}>
      {children}
    </span>
  )
}
