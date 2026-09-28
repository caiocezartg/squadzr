/**
 * Deterministic WebSocket adapter for client tests.
 *
 * `WebSocketClient` (src/lib/ws-client.ts) instantiates the global `WebSocket`
 * to connect to the real server. The vitest setup replaces that global with
 * `MockWebSocket`, so tests drive the socket lifecycle and server events
 * directly: no network, no reconnect timers, no shared state between tests.
 */

export interface MockServerMessage {
  type: string
  payload?: unknown
  timestamp?: number
}

export interface RecordedFrame {
  type: string
  payload: unknown
}

type MessageHandler = ((event: MessageEvent) => void) | null
type CloseHandler = ((event: CloseEvent) => void) | null
type ErrorHandler = ((event: Event) => void) | null

export class MockWebSocket {
  /** Mirrors the constants the global WebSocket class exposes. */
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  /** Every socket created by the current test file, oldest first. */
  static instances: MockWebSocket[] = []

  readonly url: string
  /** Raw JSON frames the client tried to send, in order. */
  sent: string[] = []
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: CloseHandler = null
  onerror: ErrorHandler = null
  onmessage: MessageHandler = null

  constructor(url: string | URL) {
    this.url = String(url)
    MockWebSocket.instances.push(this)
  }

  /** Server accepts the connection. */
  open(): void {
    if (this.readyState === MockWebSocket.OPEN) return
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  /** Server pushes an event to the client. */
  serverSend(message: MockServerMessage): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('MockWebSocket.serverSend requires an OPEN socket — call open() first')
    }
    const frame = {
      type: message.type,
      timestamp: message.timestamp ?? 0,
      payload: message.payload ?? {},
    }
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(frame) }))
  }

  send(data: string): void {
    this.sent.push(data)
  }

  /** Server closes the connection. */
  close(): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { code: 1000 }))
  }

  /** Client frames decoded from `sent`, in order. */
  sentFrames(): RecordedFrame[] {
    return this.sent.map((raw) => {
      const parsed = JSON.parse(raw) as { type: string; payload: unknown }
      return { type: parsed.type, payload: parsed.payload }
    })
  }
}

export function resetWebSocketInstances(): void {
  MockWebSocket.instances = []
}

export function latestWebSocket(): MockWebSocket {
  const socket = MockWebSocket.instances.at(-1)
  if (!socket) {
    throw new Error('No MockWebSocket instance — render a page that opens a socket first')
  }
  return socket
}
