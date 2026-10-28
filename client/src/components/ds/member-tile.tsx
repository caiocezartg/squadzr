'use client'

import type { CSSProperties, ReactNode, Ref } from 'react'
import { useTranslations } from 'next-intl'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'
import { Avatar, type AvatarState } from './avatar'

/**
 * What a parent that animates the tile hands down: the tile's `li` is the element it moves, so it takes the
 * ref and the inline style.
 */
interface TileHost {
  readonly ref?: Ref<HTMLLIElement>
  readonly style?: CSSProperties
}

interface OpenSlotProps extends TileHost {
  readonly open: true
}

interface PlayerProps extends TileHost {
  readonly open?: false
  readonly playerId: string
  readonly name: string
  /** The player's Discord image. */
  readonly image?: string | null
  readonly host?: boolean
  /** The viewer's own row reads "you". */
  readonly you?: boolean
  /**
   * In the room now; otherwise out of it. Left out, the tile shows no Presence at all: the view of a viewer
   * who is not in the Squad, who is never told who is in the room.
   */
  readonly online?: boolean
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
const UNKNOWN_LOOK: TileLook = {
  ground: 'bg-[#15161a]',
  groundColor: '#15161a',
  name: 'text-text',
  avatar: 'none',
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
      <Tile look={OPEN_LOOK} presence={t('presence.open')} host={props}>
        <Avatar state="open" surface={OPEN_LOOK.groundColor} />
        <Name look={OPEN_LOOK}>{t('openSlot')}</Name>
      </Tile>
    )
  }

  const look = presenceLook(props.online)
  const presence =
    props.online === undefined
      ? undefined
      : props.online
        ? t('presence.online')
        : timeAgo
          ? t('presence.awaySince', { time: timeAgo })
          : t('presence.away')

  return (
    <Tile look={look} presence={presence} host={props}>
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

function presenceLook(online: boolean | undefined): TileLook {
  if (online === undefined) return UNKNOWN_LOOK
  return online ? ONLINE_LOOK : AWAY_LOOK
}

function Tile({
  look,
  presence,
  host,
  children,
}: {
  readonly look: TileLook
  /** What the row says of the player's Presence; none when the viewer may not know it. */
  readonly presence?: string
  readonly host: TileHost
  readonly children: ReactNode
}) {
  return (
    <li
      ref={host.ref}
      style={host.style}
      title={presence}
      className={cn(
        'flex min-h-16 items-center gap-3.5 pt-4.5 pr-3.5 pb-3.5 pl-3 text-text',
        look.ground
      )}
    >
      {children}
      {presence && <span className="sr-only">{presence}</span>}
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
