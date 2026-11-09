import type { UserNotification } from '@/types'
import { lobbyHref } from './squad-links'

/** The Squad Board, where a notification about a Squad that no longer exists leads. */
export const BOARD_HREF = '/squads'

/**
 * Where a notification leads. A closed Squad has no Lobby any more, so its notification opens the
 * Squad Board; every other one opens the Lobby of its Squad.
 */
export function notificationHref(notification: UserNotification): string {
  return notification.type === 'room_closed' || notification.type === 'room_closed_by_admin'
    ? BOARD_HREF
    : lobbyHref(notification.payload.roomCode)
}
