'use client'

import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { notificationHref } from '@/lib/notification-links'
import { cn } from '@/lib/utils'
import type { UserNotification } from '@/types'
import {
  NotificationCover,
  NotificationMedia,
  NotificationRow,
  type NotificationRowProps,
} from './notification-row'
import { NOTIFICATION_TONES } from './notification-tone'

/** What a variant is given: its notification, narrowed to its type, and what the row needs from the list. */
export type VariantProps<T extends UserNotification['type']> = {
  readonly notification: Extract<UserNotification, { type: T }>
} & Pick<NotificationRowProps, 'disabled' | 'onOpen' | 'onDismiss'>

type RoomReadyPayload = Extract<UserNotification, { type: 'room_ready' }>['payload']
type NotificationPerson = RoomReadyPayload['players'][number]
type LeftSquad = NonNullable<RoomReadyPayload['leftSquads']>[number]

/** The facts of the row every variant reads the same way. */
function rowFacts(notification: UserNotification) {
  return {
    type: notification.type,
    squadName: notification.payload.roomName,
    gameName: notification.payload.gameName,
    createdAt: notification.createdAt,
    unread: notification.readAt === null,
    href: notificationHref(notification),
  }
}

/** A person's name inside a message. */
const personName = (chunks: ReactNode) => <b className="text-text font-bold">{chunks}</b>

/** How many players the stack shows before it counts the rest. */
const STACK_LIMIT = 5

/** The players of a filled Squad, overlapping, with a count of those past the limit. */
function PlayerStack({ players }: { readonly players: readonly NotificationPerson[] }) {
  const t = useTranslations('ds.notifications')
  if (players.length === 0) return null
  const shown = players.slice(0, STACK_LIMIT)
  const rest = players.length - shown.length

  return (
    <span aria-hidden className="flex shrink-0 items-center">
      {shown.map((player, index) => (
        <span
          key={`${player.name}-${index}`}
          className="-ml-1.5 rounded-full shadow-[0_0_0_2px_var(--ground)] first:ml-0"
        >
          <Avatar size={20} name={player.name} image={player.image} />
        </span>
      ))}
      {rest > 0 && (
        <span className="text-text-2 ml-1 text-[11px] font-bold">
          {t('morePlayers', { count: rest })}
        </span>
      )}
    </span>
  )
}

/**
 * The Squads the viewer left because this one filled, each name in its own chip. A chip is capped
 * in width and truncates a long name, so the row never grows with it; the full name stays in its
 * tooltip.
 */
function LeftSquads({ squads }: { readonly squads: readonly LeftSquad[] }) {
  const t = useTranslations('ds.notifications')
  return (
    <span className="bg-track mt-1 flex flex-col gap-1.5 px-2.25 py-2">
      <span className="text-text-3 flex items-center gap-1.5 text-[11px] font-bold tracking-[.06em] uppercase">
        <LogOut aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
        {t('leftSquads', { count: squads.length })}
      </span>
      <span className="flex flex-wrap gap-1.25">
        {squads.map((squad) => (
          <span
            key={squad.roomCode}
            title={squad.roomName}
            className="bg-panel border-line text-text block max-w-36 min-w-0 truncate border px-2 py-0.75 text-xs font-bold"
          >
            {squad.roomName}
          </span>
        ))}
      </span>
    </span>
  )
}

/** The Squad filled up: the invite is unlocked, and the Squads the viewer left for it are listed. */
export function RoomReadyNotification({ notification, ...actions }: VariantProps<'room_ready'>) {
  const t = useTranslations('ds.notifications')
  const facts = rowFacts(notification)
  const left = notification.payload.leftSquads ?? []

  return (
    <NotificationRow
      {...facts}
      {...actions}
      media={
        <NotificationMedia type="room_ready">
          <NotificationCover coverUrl={notification.payload.gameCoverUrl} />
        </NotificationMedia>
      }
      message={t('roomReady')}
      metaLead={<PlayerStack players={notification.payload.players} />}
    >
      {left.length > 0 && <LeftSquads squads={left} />}
    </NotificationRow>
  )
}

/** The viewer inherited the Squad because its owner left. */
export function HostTransferredNotification({
  notification,
  ...actions
}: VariantProps<'host_transferred'>) {
  const t = useTranslations('ds.notifications')
  const facts = rowFacts(notification)

  return (
    <NotificationRow
      {...facts}
      {...actions}
      label={t('label.hostTransferred', { squad: facts.squadName })}
      media={
        <NotificationMedia type="host_transferred">
          <NotificationCover coverUrl={notification.payload.gameCoverUrl} />
        </NotificationMedia>
      }
      message={t.rich('hostTransferred', {
        name: notification.payload.previousHost.name,
        b: personName,
      })}
    />
  )
}

/** A member of the viewer's Squad left for another one of theirs that filled. */
export function MemberLeftNotification({ notification, ...actions }: VariantProps<'member_left'>) {
  const t = useTranslations('ds.notifications')
  const facts = rowFacts(notification)
  const { member } = notification.payload

  return (
    <NotificationRow
      {...facts}
      {...actions}
      label={t('label.memberLeft', { name: member.name, squad: facts.squadName })}
      title={t.rich('memberLeftTitle', {
        name: member.name,
        squad: facts.squadName,
        chip: (chunks) => (
          <span className={cn('text-text px-1.25 py-px', NOTIFICATION_TONES.member_left.tint)}>
            {chunks}
          </span>
        ),
      })}
      media={
        <NotificationMedia type="member_left">
          <Avatar size={44} name={member.name} image={member.image} />
        </NotificationMedia>
      }
      message={t('memberLeft')}
    />
  )
}

/** The viewer's Squad was closed: its owner left and nobody who stayed could take over. */
export function RoomClosedNotification({ notification, ...actions }: VariantProps<'room_closed'>) {
  const t = useTranslations('ds.notifications')
  const facts = rowFacts(notification)

  return (
    <NotificationRow
      {...facts}
      {...actions}
      label={t('label.roomClosed', { squad: facts.squadName })}
      media={
        <NotificationMedia type="room_closed">
          <NotificationCover coverUrl={notification.payload.gameCoverUrl} className="grayscale" />
        </NotificationMedia>
      }
      message={t.rich('roomClosed', {
        name: notification.payload.previousHost.name,
        b: personName,
      })}
    />
  )
}

/** The viewer's Squad was closed by an admin: the row quotes the reason, never the admin. */
export function RoomClosedByAdminNotification({
  notification,
  ...actions
}: VariantProps<'room_closed_by_admin'>) {
  const t = useTranslations('ds.notifications')
  const facts = rowFacts(notification)

  return (
    <NotificationRow
      {...facts}
      {...actions}
      label={t('label.roomClosedByAdmin', {
        squad: facts.squadName,
        reason: notification.payload.reason,
      })}
      media={
        <NotificationMedia type="room_closed_by_admin">
          <NotificationCover coverUrl={notification.payload.gameCoverUrl} className="grayscale" />
        </NotificationMedia>
      }
      message={t('roomClosedByAdmin')}
    >
      <span className="border-danger text-text-2 mt-0.5 block border-l-2 pl-2 text-[12.75px] leading-[1.45] wrap-anywhere">
        {t('reason', { reason: notification.payload.reason })}
      </span>
    </NotificationRow>
  )
}
