import type { WebSocket } from '@fastify/websocket'
import type { Clock } from '@domain/services/clock.interface'
import type { IGetRealtimeSnapshotUseCase } from '@application/use-cases/room/get-realtime-snapshot.use-case'
import type { JoinRoomMessage, LeaveRoomMessage } from '../types'
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
  snapshots: IGetRealtimeSnapshotUseCase,
  presence: Presence,
  broadcaster: WsRoomBroadcaster
): Promise<void> {
  const client = manager.getClientData(socket)
  if (!client || !manager.isConnected(socket)) return
  const snapshot = await snapshots.subscribe(message.payload.roomCode, client.userId)
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
  if (becameOnline) broadcaster.broadcastPresence(client.roomCode, userId, true, socket)
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
