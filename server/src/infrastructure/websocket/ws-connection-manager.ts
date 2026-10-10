import type { WebSocket } from '@fastify/websocket'
import type { WsServerMessage } from '@squadzr/schemas/ws'
import type { WsClient } from './types'

export class WsConnectionManager {
  private readonly sockets = new Set<WebSocket>()
  private readonly rooms: Map<string, Set<WebSocket>> = new Map()
  private readonly clientData: WeakMap<WebSocket, WsClient> = new WeakMap()
  private readonly lobbySubscribers: Set<WebSocket> = new Set()
  private readonly userSockets: Map<string, Set<WebSocket>> = new Map()

  constructor(private readonly transportFailure: (socket: WebSocket) => void = () => {}) {}

  setClientData(socket: WebSocket, data: WsClient): void {
    this.clientData.set(socket, data)
    this.sockets.add(socket)
  }

  getClientData(socket: WebSocket): WsClient | undefined {
    return this.clientData.get(socket)
  }

  get connectionCount(): number {
    return this.sockets.size
  }

  get roomCount(): number {
    return this.rooms.size
  }

  isConnected(socket: WebSocket): boolean {
    return this.sockets.has(socket)
  }

  disconnect(socket: WebSocket): boolean {
    if (!this.sockets.delete(socket)) return false
    const client = this.clientData.get(socket)
    if (client?.userId) this.removeUserSocket(client.userId, socket)
    if (client?.roomCode) this.removeFromRoom(client.roomCode, socket)
    this.unsubscribeLobby(socket)
    if (client) {
      client.roomCode = null
      client.isInLobby = false
    }
    return true
  }

  clear(): void {
    for (const socket of this.sockets) this.disconnect(socket)
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

  getUserSockets(userId: string): Set<WebSocket> | undefined {
    return this.userSockets.get(userId)
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

    const removed = roomSockets.delete(socket)
    if (roomSockets.size === 0) {
      this.rooms.delete(roomCode)
    }
    return removed
  }

  getRoomSockets(roomCode: string): Set<WebSocket> | undefined {
    return this.rooms.get(roomCode)
  }

  deleteRoom(roomCode: string): void {
    for (const socket of this.rooms.get(roomCode) ?? []) {
      const client = this.clientData.get(socket)
      if (client) client.roomCode = null
    }
    this.rooms.delete(roomCode)
  }

  subscribeLobby(socket: WebSocket): void {
    this.lobbySubscribers.add(socket)
  }

  unsubscribeLobby(socket: WebSocket): void {
    this.lobbySubscribers.delete(socket)
  }

  getLobbySockets(): ReadonlySet<WebSocket> {
    return this.lobbySubscribers
  }

  sendToSocket(socket: WebSocket, message: WsServerMessage): void {
    if (!this.isConnected(socket) || socket.readyState !== socket.OPEN) return
    try {
      socket.send(JSON.stringify(message), (error?: Error) => {
        if (error) this.transportFailure(socket)
      })
    } catch {
      this.transportFailure(socket)
    }
  }
}
