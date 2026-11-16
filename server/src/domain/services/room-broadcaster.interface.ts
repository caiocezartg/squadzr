import type { ChatMessageView } from '@domain/entities/chat-message.entity'
import type { Room } from '@domain/entities/room.entity'
import type { UserNotification } from '@domain/entities/user-notification.entity'

export interface IRoomBroadcaster {
  broadcastRoomCreated(room: Room): void
  broadcastRoomUpdated(roomId: string, roomCode: string): void
  broadcastRoomDeleted(roomId: string, roomCode: string): void
  /**
   * Best-effort push of an already-persisted notification to its owner's open
   * sockets. A failure here never affects the persisted notification.
   */
  broadcastNotification(notification: UserNotification, discordLink: string | null): void
  /**
   * Best-effort push of a stored Chat Message to every socket that joined the Squad's
   * channel, the author's other tabs included. Lobby sockets never receive it.
   */
  broadcastChatMessage(roomCode: string, message: ChatMessageView): void
}
