import { describeContractIssues } from '@squadzr/schemas'
import {
  REALTIME_PROTOCOL_VERSION,
  protocolAnnouncementSchema,
  wsIncomingMessageSchema,
  wsServerEnvelopeSchema,
  wsServerEventPayloadSchemas,
  type WsIncomingMessageInput,
  type WsServerEventPayload,
  type WsServerEventType,
} from '@squadzr/schemas/ws'
import { parseServerEvent } from './ws-validators'

/** Transport lifecycle exposed to the UI. */
export type RealtimeStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

/** Why the client stopped trusting the server's protocol. */
export type ProtocolFailureReason = 'unparseable_frame' | 'version_mismatch' | 'invalid_protocol'

export type RealtimeEventHandler<T extends WsServerEventType> = (
  payload: WsServerEventPayload<T>
) => void

/** Registers one typed server-event handler on the connection. */
export type RealtimeEventSubscribe = <T extends WsServerEventType>(
  type: T,
  handler: RealtimeEventHandler<T>
) => () => void

export type RealtimeChannelHandlers = {
  [T in WsServerEventType]?: RealtimeEventHandler<T>
}

/**
 * Client frames that establish a stream. The transport replays them, in order,
 * after every reconnect, so callers never coordinate resubscription.
 */
export type RealtimeSubscription = Extract<
  WsIncomingMessageInput,
  { type: 'join_room' | 'subscribe_lobby' }
>

export interface WebSocketClientOptions {
  url: string
  /** First reconnection delay; each failed attempt doubles it. */
  reconnectInterval?: number
  /** Upper bound of the exponential delay before jitter. */
  reconnectMaxDelay?: number
  maxReconnectAttempts?: number
  /** Returns a value in [0, 1); injected for deterministic backoff in tests. */
  random?: () => number
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  onStatusChange?: (status: RealtimeStatus) => void
  /** A frame that cannot be parsed or a mismatched announcement; the app reloads. */
  onProtocolFailure?: (reason: ProtocolFailureReason) => void
}

/** The capped exponential delay is reduced by up to this fraction at random. */
const JITTER_RATIO = 0.5

/**
 * Closes the server uses for client misbehavior (too many invalid messages,
 * oversized frames). Retrying would repeat the same violation.
 */
const TERMINAL_CLOSE_CODES = new Set([1008, 1009])

interface SubscriptionEntry {
  message: RealtimeSubscription
  handlers: RealtimeChannelHandlers
}

/**
 * Typed WebSocket transport.
 *
 * Owns the connection state machine, exponential backoff with jitter, frame
 * parsing, payload validation against @squadzr/schemas, and the replay of
 * active subscriptions after a reconnect. Callers only see typed payloads:
 * a frame whose type or payload breaks the contract never reaches them. A
 * frame that cannot be parsed at all, or a mismatched protocol announcement,
 * is reported through `onProtocolFailure` so the app can reload into the
 * matching build.
 */
export class WebSocketClient {
  private ws: WebSocket | null = null
  private readonly url: string
  private readonly reconnectInterval: number
  private readonly reconnectMaxDelay: number
  private readonly maxReconnectAttempts: number
  private readonly random: () => number
  private reconnectAttempts = 0
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private isIntentionalClose = false
  private protocolFailed = false
  private currentStatus: RealtimeStatus = 'closed'
  private readonly eventHandlers = new Map<string, Set<(payload: unknown) => void>>()
  private readonly statusHandlers = new Set<(status: RealtimeStatus) => void>()
  private readonly subscriptions: SubscriptionEntry[] = []

  private readonly onOpenCallback?: () => void
  private readonly onCloseCallback?: () => void
  private readonly onErrorCallback?: (error: Event) => void
  private readonly onProtocolFailureCallback?: (reason: ProtocolFailureReason) => void

  constructor(options: WebSocketClientOptions) {
    this.url = options.url
    this.reconnectInterval = options.reconnectInterval ?? 3000
    this.reconnectMaxDelay = options.reconnectMaxDelay ?? 30_000
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5
    this.random = options.random ?? Math.random
    this.onOpenCallback = options.onOpen
    this.onCloseCallback = options.onClose
    this.onErrorCallback = options.onError
    this.onProtocolFailureCallback = options.onProtocolFailure
    if (options.onStatusChange) this.statusHandlers.add(options.onStatusChange)
  }

  get status(): RealtimeStatus {
    return this.currentStatus
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  connect(): void {
    if (this.protocolFailed) return
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    this.setStatus('connecting')
    this.openSocket()
  }

  disconnect(): void {
    this.isIntentionalClose = true
    this.reconnectAttempts = 0

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }

    const socket = this.ws
    this.ws = null
    if (socket) {
      // Remove handlers before closing to prevent callbacks during cleanup.
      socket.onopen = null
      socket.onclose = null
      socket.onerror = null
      socket.onmessage = null

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    }

    this.setStatus('closed')
  }

  /**
   * Sends a validated client frame. An invalid frame is rejected at runtime
   * with a diagnostic and never reaches the socket.
   */
  send(message: WsIncomingMessageInput): void {
    const parsed = wsIncomingMessageSchema.safeParse(message)
    if (!parsed.success) {
      console.error('Invalid WebSocket message:', {
        type: (message as { type?: unknown })?.type,
        issues: describeContractIssues(parsed.error),
      })
      return
    }

    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected. Message not sent:', { type: parsed.data.type })
      return
    }

    this.ws.send(
      JSON.stringify({
        type: parsed.data.type,
        payload: 'payload' in parsed.data ? parsed.data.payload : undefined,
      })
    )
  }

  /** Registers a typed handler that survives reconnections until unsubscribed. */
  on<T extends WsServerEventType>(type: T, handler: RealtimeEventHandler<T>): () => void {
    let handlers = this.eventHandlers.get(type)
    if (!handlers) {
      handlers = new Set()
      this.eventHandlers.set(type, handlers)
    }

    const stored = handler as (payload: unknown) => void
    handlers.add(stored)

    return () => {
      handlers.delete(stored)
    }
  }

  /**
   * Subscribes to a server stream: registers its handlers and (re)sends the
   * subscription frame now and after every reconnect.
   */
  subscribe(subscription: RealtimeSubscription, handlers: RealtimeChannelHandlers): () => void {
    const entry: SubscriptionEntry = { message: subscription, handlers }
    this.subscriptions.push(entry)
    this.replaySubscription(entry.message)

    return () => {
      const index = this.subscriptions.indexOf(entry)
      if (index >= 0) this.subscriptions.splice(index, 1)
    }
  }

  onStatusChange(handler: (status: RealtimeStatus) => void): () => void {
    this.statusHandlers.add(handler)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  private openSocket(): void {
    this.isIntentionalClose = false
    const socket = new WebSocket(this.url)
    this.ws = socket

    socket.onopen = () => {
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId)
        this.reconnectTimeoutId = null
      }
      this.reconnectAttempts = 0
      this.setStatus('open')
      this.onOpenCallback?.()
      for (const entry of this.subscriptions) this.replaySubscription(entry.message)
    }

    socket.onclose = (event: CloseEvent) => {
      this.onCloseCallback?.()
      if (this.isIntentionalClose) return
      this.scheduleReconnect(event.code)
    }

    socket.onerror = (error) => {
      this.onErrorCallback?.(error)
    }

    socket.onmessage = (event: MessageEvent<string>) => {
      this.handleFrame(event.data)
    }
  }

  private handleFrame(raw: string): void {
    let frame: unknown
    try {
      frame = JSON.parse(raw)
    } catch {
      console.error('Invalid WebSocket message:', { issues: [{ path: '', code: 'invalid_json' }] })
      this.failProtocol('unparseable_frame')
      return
    }

    const envelope = wsServerEnvelopeSchema.safeParse(frame)
    if (!envelope.success) {
      console.error('Invalid WebSocket message:', {
        issues: describeContractIssues(envelope.error),
      })
      this.failProtocol('unparseable_frame')
      return
    }

    if (envelope.data.type === 'protocol') {
      this.handleProtocolAnnouncement(envelope.data.payload)
      return
    }

    this.dispatch(envelope.data.type, envelope.data.payload)
  }

  /**
   * The server announces its protocol version on connect. A mismatched or
   * unparseable announcement means this build cannot understand the server;
   * the app is told to reload into the matching build.
   */
  private handleProtocolAnnouncement(raw: unknown): void {
    const announcement = protocolAnnouncementSchema.safeParse(raw)
    if (!announcement.success) {
      this.failProtocol('invalid_protocol')
      return
    }
    if (announcement.data.version !== REALTIME_PROTOCOL_VERSION) {
      this.failProtocol('version_mismatch')
    }
  }

  private failProtocol(reason: ProtocolFailureReason): void {
    if (this.protocolFailed) return
    this.protocolFailed = true
    console.error('Realtime protocol failure:', {
      reason,
      expectedVersion: REALTIME_PROTOCOL_VERSION,
    })
    this.disconnect()
    this.onProtocolFailureCallback?.(reason)
  }

  private dispatch(type: string, raw: unknown): void {
    if (!Object.hasOwn(wsServerEventPayloadSchemas, type)) return

    const payload = parseServerEvent(type as WsServerEventType, raw)
    if (payload === null) return

    for (const handler of this.eventHandlers.get(type) ?? []) {
      this.invoke(type, handler, payload)
    }

    for (const entry of this.subscriptions) {
      const handler = entry.handlers[type as WsServerEventType] as
        | ((payload: unknown) => void)
        | undefined
      if (handler) this.invoke(type, handler, payload)
    }
  }

  private invoke(type: string, handler: (payload: unknown) => void, payload: unknown): void {
    try {
      handler(payload)
    } catch {
      console.error('WebSocket handler failed:', { type })
    }
  }

  private replaySubscription(message: RealtimeSubscription): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({
        type: message.type,
        payload: 'payload' in message ? message.payload : undefined,
      })
    )
  }

  private scheduleReconnect(closeCode: number): void {
    if (this.protocolFailed) return

    // A stale close event from a socket that a newer connection already
    // replaced must not schedule another attempt.
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    if (TERMINAL_CLOSE_CODES.has(closeCode)) {
      this.setStatus('closed')
      return
    }

    if (this.reconnectTimeoutId) return

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.setStatus('closed')
      return
    }

    this.reconnectAttempts++
    const capped = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      this.reconnectMaxDelay
    )
    const delay = Math.round(capped * (1 - this.random() * JITTER_RATIO))

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    )

    this.setStatus('reconnecting')
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null
      if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
        return
      }
      this.openSocket()
    }, delay)
  }

  private setStatus(status: RealtimeStatus): void {
    if (this.currentStatus === status) return
    this.currentStatus = status
    for (const handler of this.statusHandlers) handler(status)
  }
}
