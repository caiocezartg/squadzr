'use client'

import { Crown, DoorClosed, UserMinus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { DiscordIcon } from '@/components/ui/icons'
import { notificationHref } from '@/lib/notification-links'
import type { UserNotification } from '@/types'
import {
  NotificationCover,
  NotificationMedia,
  NotificationRow,
  type NotificationRowProps,
} from './notification-row'

/** What a variant is given: its notification, narrowed to its type, and what the row needs from the list. */
export type VariantProps<T extends UserNotification['type']> = {
  readonly notification: Extract<UserNotification, { type: T }>
} & Pick<NotificationRowProps, 'disabled' | 'onOpen' | 'onDismiss'>

/** The facts of the row every variant reads the same way. */
function rowFacts(notification: UserNotification) {
  return {
    squadName: notification.payload.roomName,
    gameName: notification.payload.gameName,
    createdAt: notification.createdAt,
    unread: notification.readAt === null,
    href: notificationHref(notification),
  }
}

const NEUTRAL_BADGE = 'bg-track text-text-2'

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
        <NotificationMedia
          badgeClassName="bg-discord text-white"
          badge={<DiscordIcon aria-hidden className="size-3" />}
        >
          <NotificationCover
            coverUrl={notification.payload.gameCoverUrl}
            className={facts.unread ? undefined : 'grayscale-60'}
          />
        </NotificationMedia>
      }
      message={
        <>
          {t('roomReady')}
          {left.length > 0 && (
            <span className="block">
              {t('leftSquads', {
                count: left.length,
                squads: left.map((squad) => squad.roomName).join(', '),
              })}
            </span>
          )}
        </>
      }
    />
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
        <NotificationMedia
          badgeClassName="bg-mint text-mint-ink"
          badge={<Crown aria-hidden className="size-3" strokeWidth={2.6} />}
        >
          <NotificationCover
            coverUrl={notification.payload.gameCoverUrl}
            className={facts.unread ? undefined : 'grayscale-60'}
          />
        </NotificationMedia>
      }
      message={t('hostTransferred', { name: notification.payload.previousHost.name })}
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
      media={
        <NotificationMedia
          badgeClassName={NEUTRAL_BADGE}
          badge={<UserMinus aria-hidden className="size-3" strokeWidth={2.4} />}
        >
          <span className={facts.unread ? undefined : 'opacity-60'}>
            <Avatar size={36} name={member.name} image={member.image} />
          </span>
        </NotificationMedia>
      }
      message={t('memberLeft', { name: member.name })}
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
        <NotificationMedia
          badgeClassName={NEUTRAL_BADGE}
          badge={<DoorClosed aria-hidden className="size-3" strokeWidth={2.4} />}
        >
          <NotificationCover coverUrl={notification.payload.gameCoverUrl} className="grayscale" />
        </NotificationMedia>
      }
      message={t('roomClosed')}
    />
  )
}
