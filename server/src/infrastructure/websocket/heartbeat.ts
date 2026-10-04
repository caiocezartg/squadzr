import type { WebSocket } from '@fastify/websocket'
import type { Clock } from '@domain/services/clock.interface'

export const HEARTBEAT_INTERVAL_MS = 20_000
export const HEARTBEAT_TIMEOUT_MS = 40_000

export class Heartbeat {
  private readonly connections = new Map<WebSocket, { pongAt: number; pingAt: number }>()

  constructor(
    private readonly clock: Clock,
    private readonly timedOut: (socket: WebSocket) => void
  ) {}

  add(socket: WebSocket): void {
    const now = this.clock.now().getTime()
    this.connections.set(socket, { pongAt: now, pingAt: now })
  }

  pong(socket: WebSocket): void {
    const connection = this.connections.get(socket)
    if (connection) connection.pongAt = this.clock.now().getTime()
  }

  remove(socket: WebSocket): void {
    this.connections.delete(socket)
  }

  sweep(): void {
    const now = this.clock.now().getTime()
    for (const [socket, connection] of this.connections) {
      if (now - connection.pongAt >= HEARTBEAT_TIMEOUT_MS) {
        this.connections.delete(socket)
        this.timedOut(socket)
        socket.terminate()
      } else if (now - connection.pingAt >= HEARTBEAT_INTERVAL_MS) {
        connection.pingAt = now
        if (socket.readyState === socket.OPEN) socket.ping()
      }
    }
  }

  clear(): void {
    this.connections.clear()
  }
}
