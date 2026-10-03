import { describeContractIssues } from '@squadzr/schemas'
import { wsServerEnvelopeSchema, type WsServerEnvelope } from '@squadzr/schemas/ws'

export type WebSocketEventHandler = (data: unknown) => void

/**
 * Reads a server frame as { type, timestamp, payload }. A frame that is not
 * JSON or has no string type is reported by issue path and code only: neither
 * the raw frame nor the parser message, which quotes it, reaches the log.
 */
function parseServerFrame(raw: string): WsServerEnvelope | null {
  let frame: unknown
  try {
    frame = JSON.parse(raw)
  } catch {
    console.error('Invalid WebSocket message:', { issues: [{ path: '', code: 'invalid_json' }] })
    return null
  }

  const envelope = wsServerEnvelopeSchema.safeParse(frame)
  if (!envelope.success) {
    console.error('Invalid WebSocket message:', {
      issues: describeContractIssues(envelope.error),
    })
    return null
  }
  return envelope.data
}

interface WebSocketClientOptions {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectInterval: number
  private maxReconnectAttempts: number
  private reconnectAttempts = 0
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private isIntentionalClose = false
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map()

  private onOpenCallback?: () => void
  private onCloseCallback?: () => void
  private onErrorCallback?: (error: Event) => void

  constructor(options: WebSocketClientOptions) {
    this.url = options.url
    this.reconnectInterval = options.reconnectInterval ?? 3000
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5
    this.onOpenCallback = options.onOpen
    this.onCloseCallback = options.onClose
    this.onErrorCallback = options.onError
  }

  connect(): void {
    // Skip if already open or connecting
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    this.isIntentionalClose = false
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      // Connection succeeded, clear any pending reconnect timer.
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId)
        this.reconnectTimeoutId = null
      }
      this.reconnectAttempts = 0
      this.onOpenCallback?.()
    }

    this.ws.onclose = () => {
      this.onCloseCallback?.()

      if (!this.isIntentionalClose) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (error) => {
      this.onErrorCallback?.(error)
    }

    this.ws.onmessage = (event: MessageEvent<string>) => {
      const message = parseServerFrame(event.data)
      if (!message) return

      const handlers = this.eventHandlers.get(message.type)
      if (!handlers) return

      try {
        handlers.forEach((handler) => handler(message.payload))
      } catch {
        console.error('WebSocket handler failed:', { type: message.type })
      }
    }
  }

  disconnect(): void {
    this.isIntentionalClose = true

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }

    if (this.ws) {
      // Remove handlers before closing to prevent callbacks during cleanup
      // This avoids "WebSocket closed before connection established" errors
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null

      // Only close if not already closed/closing
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }
  }

  send(type: string, payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected. Message not sent:', { type, payload })
      return
    }

    // Server expects { type, payload }
    this.ws.send(JSON.stringify({ type, payload }))
  }

  on(event: string, handler: WebSocketEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }

    this.eventHandlers.get(event)?.add(handler)

    return () => {
      this.eventHandlers.get(event)?.delete(handler)
    }
  }

  off(event: string, handler: WebSocketEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1)

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    )

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null
      this.connect()
    }, delay)
  }
}
