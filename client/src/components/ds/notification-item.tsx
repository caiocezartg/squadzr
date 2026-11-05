'use client'

import type { UserNotification } from '@/types'
import {
  HostTransferredNotification,
  MemberLeftNotification,
  RoomClosedNotification,
  RoomReadyNotification,
} from './notification-variants'

export interface NotificationItemProps {
  readonly notification: UserNotification
  /** Both controls wait while a change is in flight. */
  readonly disabled?: boolean | undefined
  /** A plain click opens the notification here; a modified click keeps the browser's own link behaviour. */
  readonly onOpen: () => void
  readonly onDismiss: () => void
}

/**
 * A notification as a row of the notifications panel (reference, Components). Each type has its
 * own row, with the media, badge and message of what happened: a Squad that filled (the cover and
 * Discord), an inherited Squad (the cover and a crown), a member who left (their avatar), a closed
 * Squad (a grey cover). They share one structure and differ only in those three. This is the one
 * place that tells the types apart.
 */
export function NotificationItem({ notification, ...actions }: NotificationItemProps) {
  switch (notification.type) {
    case 'room_ready':
      return <RoomReadyNotification notification={notification} {...actions} />
    case 'host_transferred':
      return <HostTransferredNotification notification={notification} {...actions} />
    case 'member_left':
      return <MemberLeftNotification notification={notification} {...actions} />
    case 'room_closed':
      return <RoomClosedNotification notification={notification} {...actions} />
  }
}
