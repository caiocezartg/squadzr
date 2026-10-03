import type { WebSocket } from '@fastify/websocket'
import type { WsClient, WsServerMessage } from './types'

export class WsConnectionManager {
  private readonly rooms: Map<string, Set<WebSocket>> = new Map()
  private readonly clientData: WeakMap<WebSocket, WsClient> = new WeakMap()
  private readonly lobbySubscribers: Set<WebSocket> = new Set()
  private readonly userSockets: Map<string, Set<WebSocket>> = new Map()

  setClientData(socket: WebSocket, data: WsClient): void {
    this.clientData.set(socket, data)
  }

  getClientData(socket: WebSocket): WsClient | undefined {
    return this.clientData.get(socket)
  }

  /** Indexes an authenticated socket so user-targeted pushes (notifications) can reach it. */
  addUserSocket(userId: string, socket: WebSocket): void {
    let sockets = this.userSockets.get(userId)
    if (!sockets) {
      sockets = new Set()
      this.userSockets.set(userId, sockets)
    }
    sockets.add(socket)
  }

  removeUserSocket(userId: string, socket: WebSocket): void {
    const sockets = this.userSockets.get(userId)
    if (!sockets) return

    sockets.delete(socket)
    if (sockets.size === 0) {
      this.userSockets.delete(userId)
    }
  }

  addToRoom(roomCode: string, socket: WebSocket): void {
    let roomSockets = this.rooms.get(roomCode)
    if (!roomSockets) {
      roomSockets = new Set()
      this.rooms.set(roomCode, roomSockets)
    }
    roomSockets.add(socket)
  }

  removeFromRoom(roomCode: string, socket: WebSocket): boolean {
    const roomSockets = this.rooms.get(roomCode)
    if (!roomSockets) return false

    roomSockets.delete(socket)
    if (roomSockets.size === 0) {
      this.rooms.delete(roomCode)
    }
    return true
  }

  getRoomSockets(roomCode: string): Set<WebSocket> | undefined {
    return this.rooms.get(roomCode)
  }

  deleteRoom(roomCode: string): void {
    this.rooms.delete(roomCode)
  }

  subscribeLobby(socket: WebSocket): void {
    this.lobbySubscribers.add(socket)
  }

  unsubscribeLobby(socket: WebSocket): void {
    this.lobbySubscribers.delete(socket)
  }

  broadcastToRoom(roomCode: string, message: WsServerMessage, excludeSocket?: WebSocket): void {
    const roomSockets = this.rooms.get(roomCode)
    if (!roomSockets) return

    for (const socket of roomSockets) {
      if (socket !== excludeSocket) {
        this.sendToSocket(socket, message)
      }
    }
  }

  broadcastToLobby(message: WsServerMessage): void {
    for (const socket of this.lobbySubscribers) {
      this.sendToSocket(socket, message)
    }
  }

  broadcastToRoomAndLobby(roomCode: string, message: WsServerMessage): void {
    this.broadcastToLobby(message)
    this.broadcastToRoom(roomCode, message)
  }

  /** Best-effort push to every open socket of one authenticated user. */
  broadcastToUser(userId: string, message: WsServerMessage): void {
    const sockets = this.userSockets.get(userId)
    if (!sockets) return

    for (const socket of sockets) {
      this.sendToSocket(socket, message)
    }
  }

  private sendToSocket(socket: WebSocket, message: WsServerMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }
}
