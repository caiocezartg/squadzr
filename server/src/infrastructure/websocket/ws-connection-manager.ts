import type { WebSocket } from '@fastify/websocket'
import type { WsClient, WsServerMessage } from './types'

export class WsConnectionManager {
  private readonly rooms: Map<string, Set<WebSocket>> = new Map()
  private readonly clientData: WeakMap<WebSocket, WsClient> = new WeakMap()
  private readonly lobbySubscribers: Set<WebSocket> = new Set()

  setClientData(socket: WebSocket, data: WsClient): void {
    this.clientData.set(socket, data)
  }

  getClientData(socket: WebSocket): WsClient | undefined {
    return this.clientData.get(socket)
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

  private sendToSocket(socket: WebSocket, message: WsServerMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }
}
