import type { WebSocket } from '@fastify/websocket'
import type { ChatSendMessage, JoinRoomMessage, LeaveRoomMessage } from '@squadzr/schemas/ws'
import type { Clock } from '@domain/services/clock.interface'
import type { ISubscribeRealtimeSnapshotUseCase } from '@application/use-cases/room/subscribe-realtime-snapshot.use-case'
import type { IListChatHistoryUseCase } from '@application/use-cases/chat/list-chat-history.use-case'
import type { ISendChatMessageUseCase } from '@application/use-cases/chat/send-chat-message.use-case'
import type { WsConnectionManager } from '../ws-connection-manager'
import type { WsRoomBroadcaster } from '../room-broadcaster.service'
import type { Presence } from '../presence'

export function sendError(
  socket: WebSocket,
  code: string,
  message: string,
  manager: WsConnectionManager,
  clock: Clock
): void {
  manager.sendToSocket(socket, {
    type: 'error',
    timestamp: clock.now().getTime(),
    payload: { code, message },
  })
}

export async function handleJoinRoom(
  socket: WebSocket,
  message: JoinRoomMessage,
  manager: WsConnectionManager,
  subscribeSnapshot: ISubscribeRealtimeSnapshotUseCase,
  listChatHistory: IListChatHistoryUseCase,
  presence: Presence,
  broadcaster: WsRoomBroadcaster
): Promise<void> {
  const client = manager.getClientData(socket)
  if (!client || !manager.isConnected(socket)) return
  const snapshot = await subscribeSnapshot.execute({
    code: message.payload.roomCode,
    userId: client.userId,
  })
  // Read before the checks below, so nothing is awaited between them and the sends.
  const history = await listChatHistory.execute({ roomId: snapshot.room.id })
  const { userId } = snapshot
  // A disconnect during the query must never resurrect a subscription.
  if (!manager.isConnected(socket) || socket.readyState !== socket.OPEN) return
  if (client.roomCode && client.roomCode !== snapshot.room.code) {
    handleLeaveRoom(
      socket,
      { type: 'leave_room', timestamp: 0, payload: { roomCode: client.roomCode } },
      manager,
      presence
    )
  }
  // Expired grace transitions belong to existing subscribers, before this socket's snapshot.
  const becameOnline = presence.join(snapshot.room.code, userId, socket)
  client.roomCode = snapshot.room.code
  manager.addToRoom(client.roomCode, socket)
  broadcaster.sendSnapshot(socket, snapshot)
  // A Squad without messages sends no history: the client keeps what it has, which is nothing new.
  if (history.length > 0) broadcaster.sendChatHistory(socket, client.roomCode, history)
  if (becameOnline) broadcaster.broadcastPresence(client.roomCode, userId, true, socket)
}

/**
 * A chat message from a socket in the Squad's channel. The use case checks the Membership again, so a member
 * who left the Squad from another tab cannot keep writing through a channel this tab still holds.
 */
export async function handleChatSend(
  socket: WebSocket,
  message: ChatSendMessage,
  manager: WsConnectionManager,
  sendChatMessage: ISendChatMessageUseCase,
  broadcaster: WsRoomBroadcaster
): Promise<void> {
  const client = manager.getClientData(socket)
  if (!client || client.roomCode !== message.payload.roomCode) return
  const sent = await sendChatMessage.execute({
    code: message.payload.roomCode,
    userId: client.userId,
    body: message.payload.body,
  })
  broadcaster.broadcastChatMessage(sent.roomCode, sent.message)
}

export function handleLeaveRoom(
  socket: WebSocket,
  message: LeaveRoomMessage,
  manager: WsConnectionManager,
  presence: Presence
): void {
  const client = manager.getClientData(socket)
  if (!client?.roomCode || client.roomCode !== message.payload.roomCode) return
  manager.removeFromRoom(client.roomCode, socket)
  if (client.userId) presence.leave(client.roomCode, client.userId, socket)
  client.roomCode = null
}

export function handleDisconnect(
  socket: WebSocket,
  manager: WsConnectionManager,
  presence: Presence
): boolean {
  const client = manager.getClientData(socket)
  const roomCode = client?.roomCode
  const userId = client?.userId
  if (!manager.disconnect(socket)) return false
  if (roomCode && userId) presence.leave(roomCode, userId, socket)
  return true
}

export function handleSubscribeLobby(
  socket: WebSocket,
  manager: WsConnectionManager,
  clock: Clock
): void {
  const client = manager.getClientData(socket)
  if (!client || !manager.isConnected(socket)) return
  manager.subscribeLobby(socket)
  client.isInLobby = true
  manager.sendToSocket(socket, {
    type: 'lobby_subscribed',
    timestamp: clock.now().getTime(),
    payload: { message: 'Subscribed to room list updates' },
  })
}

export function handleUnsubscribeLobby(socket: WebSocket, manager: WsConnectionManager): void {
  manager.unsubscribeLobby(socket)
  const client = manager.getClientData(socket)
  if (client) client.isInLobby = false
}
