import { z } from 'zod'
import type { Player } from './data-commands'

const CONNECT_TIMEOUT_MS = 15_000

const incomingSchema = z.object({
  type: z.string(),
  payload: z.object({ code: z.string().optional() }).passthrough().optional(),
})

export interface FleetSummary {
  readonly attempted: number
  readonly connected: number
  readonly peakOpen: number
  readonly openNow: number
  readonly connectFailures: number
  readonly unexpectedCloses: Readonly<Record<string, number>>
  readonly messages: number
  readonly serverErrors: Readonly<Record<string, number>>
}

function tally(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/** The players' WebSocket sessions: opened at a pace, kept open, and counted. */
export class SocketFleet {
  private readonly sockets = new Map<string, WebSocket>()
  private readonly closing = new Set<WebSocket>()
  private readonly closes = new Map<string, number>()
  private readonly errors = new Map<string, number>()
  private attempted = 0
  private connected = 0
  private connectFailures = 0
  private messages = 0
  private peak = 0

  constructor(
    private readonly url: string,
    private readonly origin: string
  ) {}

  get openNow(): number {
    let open = 0
    for (const socket of this.sockets.values()) if (socket.readyState === WebSocket.OPEN) open += 1
    return open
  }

  /** Opens the player's socket and resolves true once the server's protocol greeting arrives. */
  connect(player: Player): Promise<boolean> {
    this.attempted += 1
    return new Promise((resolve) => {
      let settled = false
      const settle = (ok: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (ok) {
          this.connected += 1
          this.peak = Math.max(this.peak, this.openNow)
        } else {
          this.connectFailures += 1
        }
        resolve(ok)
      }
      const socket = new WebSocket(this.url, {
        headers: { cookie: player.cookie, origin: this.origin },
      } as unknown as string[])
      const timer = setTimeout(() => {
        settle(false)
        socket.close()
      }, CONNECT_TIMEOUT_MS)
      this.sockets.set(player.id, socket)
      socket.onmessage = (event) => {
        this.messages += 1
        const message = this.parse(event.data)
        if (message?.type === 'protocol') settle(true)
        if (message?.type === 'error') tally(this.errors, message.payload?.code ?? 'unknown')
      }
      socket.onerror = () => settle(false)
      socket.onclose = (event) => {
        if (!settled) settle(false)
        else if (!this.closing.has(socket)) tally(this.closes, String(event.code))
      }
    })
  }

  private parse(data: unknown): z.infer<typeof incomingSchema> | null {
    try {
      const result = incomingSchema.safeParse(JSON.parse(String(data)))
      return result.success ? result.data : null
    } catch {
      return null
    }
  }

  send(player: Player, message: { type: string; payload?: unknown }): void {
    const socket = this.sockets.get(player.id)
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ ...message, timestamp: Date.now() }))
    }
  }

  closeAll(): void {
    for (const socket of this.sockets.values()) {
      this.closing.add(socket)
      if (socket.readyState <= WebSocket.OPEN) socket.close(1000, 'load test over')
    }
  }

  summary(): FleetSummary {
    return {
      attempted: this.attempted,
      connected: this.connected,
      peakOpen: this.peak,
      openNow: this.openNow,
      connectFailures: this.connectFailures,
      unexpectedCloses: Object.fromEntries(this.closes),
      messages: this.messages,
      serverErrors: Object.fromEntries(this.errors),
    }
  }
}
