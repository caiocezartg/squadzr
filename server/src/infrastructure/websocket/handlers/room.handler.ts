import type { WebSocket } from '@fastify/websocket'
import type { PlayerDto } from '@squadzr/schemas'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { User } from '@domain/entities/user.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { Clock } from '@domain/services/clock.interface'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'
import type {
  JoinRoomMessage,
  LeaveRoomMessage,
  WsClient,
  RoomJoinedMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  ViewerLeftMessage,
  RoomReadyMessage,
  ErrorMessage,
  LobbySubscribedMessage,
  WsServerMessage,
} from '../types'
import type { WsConnectionManager } from '../ws-connection-manager'

function sendToSocket(socket: WebSocket, message: WsServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

export function sendError(socket: WebSocket, code: string, message: string): void {
  const errorMessage: ErrorMessage = {
    type: 'error',
    timestamp: Date.now(),
    payload: { code, message },
  }
  sendToSocket(socket, errorMessage)
}

function buildPlayerList(members: RoomMember[], users: User[], hostId: string): PlayerDto[] {
  const usersById = new Map(users.map((u) => [u.id, u]))
  return members.map((member) => {
    const u = usersById.get(member.userId)
    return {
      id: member.userId,
      name: u?.name ?? 'Unknown',
      image: u?.avatarUrl ?? null,
      isHost: member.userId === hostId,
    }
  })
}

function broadcastRoomReadyIfFull(
  roomCode: string,
  roomId: string,
  memberCount: number,
  maxPlayers: number,
  connectionManager: WsConnectionManager
): void {
  if (memberCount < maxPlayers) return
  const msg: RoomReadyMessage = {
    type: 'room_ready',
    timestamp: Date.now(),
    payload: { roomId, roomCode, message: 'Room is full! Time to play!' },
  }
  connectionManager.broadcastToRoom(roomCode, msg)
}

export async function handleJoinRoom(
  socket: WebSocket,
  message: JoinRoomMessage,
  connectionManager: WsConnectionManager,
  roomRepository: IRoomRepository,
  roomMemberRepository: IRoomMemberRepository,
  userRepository: IUserRepository,
  clock: Clock
): Promise<void> {
  const { roomCode } = message.payload
  const client = connectionManager.getClientData(socket)

  if (!client) {
    sendError(socket, 'INVALID_CLIENT', 'Client not initialized')
    return
  }
  if (!client.userId) {
    sendError(socket, 'UNAUTHORIZED', 'Authentication required')
    return
  }

  const room = await roomRepository.findByCode(roomCode)
  if (!room) {
    sendError(socket, 'ROOM_NOT_FOUND', `Room "${roomCode}" not found`)
    return
  }

  // An expired room is gone for reads and subscriptions even before deletion.
  if (isRoomExpired(room, clock.now(), ROOM)) {
    sendError(socket, 'ROOM_NOT_FOUND', `Room "${roomCode}" not found`)
    return
  }

  const membership = await roomMemberRepository.findByRoomAndUser(room.id, client.userId)
  if (!membership) {
    sendError(socket, 'NOT_ROOM_MEMBER', 'You are not a member of this room')
    return
  }

  connectionManager.addToRoom(roomCode, socket)
  client.roomCode = roomCode

  const members = await roomMemberRepository.findByRoomId(room.id)
  const users = await userRepository.findByIds(members.map((m) => m.userId))
  const players = buildPlayerList(members, users, room.hostId)

  const joinedMessage: RoomJoinedMessage = {
    type: 'room_joined',
    timestamp: Date.now(),
    payload: { roomId: room.id, roomCode: room.code, players },
  }
  sendToSocket(socket, joinedMessage)

  const playerJoinedMessage: PlayerJoinedMessage = {
    type: 'player_joined',
    timestamp: Date.now(),
    payload: {
      player: {
        id: client.userId,
        name: client.userName ?? 'Unknown',
        image: client.userImage,
        isHost: client.userId === room.hostId,
      },
    },
  }
  connectionManager.broadcastToRoom(roomCode, playerJoinedMessage, socket)

  const memberCount = await roomMemberRepository.countByRoomId(room.id)
  broadcastRoomReadyIfFull(roomCode, room.id, memberCount, room.maxPlayers, connectionManager)
}

export async function handleLeaveRoom(
  socket: WebSocket,
  message: LeaveRoomMessage,
  connectionManager: WsConnectionManager
): Promise<void> {
  const { roomCode } = message.payload
  const client = connectionManager.getClientData(socket)

  if (!client) {
    sendError(socket, 'INVALID_CLIENT', 'Client not initialized')
    return
  }

  if (!client.userId) {
    sendError(socket, 'UNAUTHORIZED', 'Authentication required')
    return
  }

  const hadSockets = connectionManager.removeFromRoom(roomCode, socket)

  if (hadSockets) {
    const roomSockets = connectionManager.getRoomSockets(roomCode)
    if (roomSockets && roomSockets.size > 0) {
      // Broadcast player_left to remaining clients
      const playerLeftMessage: PlayerLeftMessage = {
        type: 'player_left',
        timestamp: Date.now(),
        payload: { playerId: client.userId },
      }
      connectionManager.broadcastToRoom(roomCode, playerLeftMessage)
    }
  }

  client.roomCode = null
}

export function handleDisconnect(socket: WebSocket, connectionManager: WsConnectionManager): void {
  const client = connectionManager.getClientData(socket)

  // Remove from lobby subscribers
  if (client?.isInLobby) {
    connectionManager.unsubscribeLobby(socket)
    client.isInLobby = false
  }

  if (!client?.roomCode) return
  if (!client.userId) return

  // Cleared up front so a second call (both `error` and `close` fire) is a no-op
  const roomCode = client.roomCode
  client.roomCode = null
  connectionManager.removeFromRoom(roomCode, socket)

  const roomSockets = connectionManager.getRoomSockets(roomCode)
  if (roomSockets && roomSockets.size > 0) {
    const viewerLeftMessage: ViewerLeftMessage = {
      type: 'viewer_left',
      timestamp: Date.now(),
      payload: { playerId: client.userId, roomCode },
    }
    connectionManager.broadcastToRoom(roomCode, viewerLeftMessage)
  }
}

// Lobby subscription handlers
export function handleSubscribeLobby(
  socket: WebSocket,
  connectionManager: WsConnectionManager
): void {
  const client = connectionManager.getClientData(socket)
  if (!client) {
    sendError(socket, 'INVALID_CLIENT', 'Client not initialized')
    return
  }

  connectionManager.subscribeLobby(socket)
  client.isInLobby = true

  const message: LobbySubscribedMessage = {
    type: 'lobby_subscribed',
    timestamp: Date.now(),
    payload: { message: 'Subscribed to room list updates' },
  }
  sendToSocket(socket, message)
}

export function handleUnsubscribeLobby(
  socket: WebSocket,
  connectionManager: WsConnectionManager
): void {
  const client = connectionManager.getClientData(socket)
  if (!client) return

  connectionManager.unsubscribeLobby(socket)
  client.isInLobby = false
}

// Keep setClientData as a convenience wrapper
export function setClientData(
  socket: WebSocket,
  data: WsClient,
  connectionManager: WsConnectionManager
): void {
  connectionManager.setClientData(socket, data)
}
