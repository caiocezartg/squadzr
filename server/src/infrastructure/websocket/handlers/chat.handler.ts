import type { WebSocket } from '@fastify/websocket'
import type { ChatTypingFrame } from '@squadzr/schemas/ws'
import type { WsConnectionManager } from '../ws-connection-manager'
import type { WsRoomBroadcaster } from '../room-broadcaster.service'
import type { TypingThrottle } from '../typing-throttle'

/**
 * Forwards "this member is typing" to the Squad's other members. Typing is not a business rule: nothing
 * is stored and no use case runs. `client.roomCode` is set only once the Squad's snapshot use case has
 * confirmed the Membership, so a socket that has not joined that Squad has nothing to say in it.
 */
export function handleChatTyping(
  socket: WebSocket,
  message: ChatTypingFrame,
  manager: WsConnectionManager,
  broadcaster: WsRoomBroadcaster,
  throttle: TypingThrottle
): void {
  const client = manager.getClientData(socket)
  if (!client?.userId || client.roomCode !== message.payload.roomCode) return
  if (!throttle.allow()) return
  broadcaster.broadcastChatTyping(client.roomCode, client.userId)
}
