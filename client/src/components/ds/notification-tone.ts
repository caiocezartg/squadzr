import type { ComponentType } from 'react'
import { Crown, DoorClosed, UserMinus, Users, type LucideIcon } from 'lucide-react'
import { DiscordIcon } from '@/components/ui/icons'
import type { UserNotification } from '@/types'

/**
 * The colour of a notification type and what it paints: the unread left edge, the eyebrow, the
 * badge on the media, a tint for a highlighted Squad name and the title. Each value is a full class
 * string, so Tailwind sees it.
 */
export interface NotificationTone {
  /** The 3px inset edge of an unread row. */
  readonly edge: string
  /** The eyebrow's colour. */
  readonly text: string
  /** The badge's ground and icon colours. */
  readonly badge: string
  /** A Squad name highlighted in the title. */
  readonly tint: string
  /** The title's colour and decoration. */
  readonly title: string
  /** The eyebrow's icon. */
  readonly Icon: LucideIcon
  /** The badge's icon: the eyebrow's, or Discord's on a filled Squad. */
  readonly BadgeIcon: ComponentType<{ readonly className?: string }>
}

export type NotificationType = UserNotification['type']

export const NOTIFICATION_TONES: Record<NotificationType, NotificationTone> = {
  room_ready: {
    edge: 'shadow-[inset_3px_0_0_var(--color-mint)]',
    text: 'text-mint',
    badge: 'bg-discord text-white',
    tint: 'bg-mint/13',
    title: 'text-text',
    Icon: Users,
    BadgeIcon: DiscordIcon,
  },
  host_transferred: {
    edge: 'shadow-[inset_3px_0_0_var(--color-amber)]',
    text: 'text-amber',
    badge: 'bg-amber text-mint-ink',
    tint: 'bg-amber/13',
    title: 'text-text',
    Icon: Crown,
    BadgeIcon: Crown,
  },
  member_left: {
    edge: 'shadow-[inset_3px_0_0_var(--color-discord-soft)]',
    text: 'text-discord-soft',
    badge: 'bg-discord-soft text-mint-ink',
    tint: 'bg-discord-soft/13',
    title: 'text-text',
    Icon: UserMinus,
    BadgeIcon: UserMinus,
  },
  room_closed: {
    edge: 'shadow-[inset_3px_0_0_var(--color-danger)]',
    text: 'text-danger',
    badge: 'bg-danger text-mint-ink',
    tint: 'bg-danger/13',
    title: 'text-text-3 line-through decoration-danger/60',
    Icon: DoorClosed,
    BadgeIcon: DoorClosed,
  },
}
