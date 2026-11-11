import type { Duplex } from 'node:stream'
import type { WebSocket } from '@fastify/websocket'
import { z } from 'zod'
import { protocolMessageSchema } from '@squadzr/schemas/ws'
import type { TestUser } from './auth'
import type { TestServer } from './test-server'

const serverMessageSchema = z.object({
  type: z.string(),
  timestamp: z.number(),
  payload: z.unknown().optional(),
})

export type ServerMessage = z.infer<typeof serverMessageSchema>

export interface CloseInfo {
  code: number
  reason: string
}

/**
 * One in-memory WebSocket session opened through `app.injectWS` (no TCP, no ports).
 * `client` is the test's end of the socket; `server` is the socket handed to the
 * `/ws` route, whose `close` event is what triggers the plugin's cleanup.
 */
export interface RealtimeSession {
  protocol: z.infer<typeof protocolMessageSchema>
  client: WebSocket
  server: WebSocket
  send: (message: unknown) => void
  sendRaw: (data: string | Buffer) => void
  /** Resolves with the next unread server message, strictly in arrival order. */
  next: () => Promise<ServerMessage>
  /**
   * Waits for all scoped queues, then uses a ping/pong to flush the transport.
   * Application pongs bypass room work and cannot serve as queue completion signals.
   */
  drain: () => Promise<ServerMessage[]>
  /** Resolves once the server-side socket has closed and the plugin has cleaned up. */
  serverClosed: Promise<CloseInfo>
  clientClosed: Promise<CloseInfo>
}

function closeInfo(socket: WebSocket): Promise<CloseInfo> {
  return new Promise((resolve) =>
    socket.once('close', (code: number, reason: Buffer) =>
      resolve({ code, reason: reason.toString() })
    )
  )
}

function createInbox(client: WebSocket) {
  const unread: ServerMessage[] = []
  const waiters: Array<(message: ServerMessage) => void> = []

  client.on('message', (raw: Buffer) => {
    const message = serverMessageSchema.parse(JSON.parse(raw.toString()))
    const waiter = waiters.shift()
    if (waiter) waiter(message)
    else unread.push(message)
  })

  return (): Promise<ServerMessage> => {
    const message = unread.shift()
    if (message) return Promise.resolve(message)
    return new Promise((resolve) => waiters.push(resolve))
  }
}

/**
 * `injectWS` wires both ends through an in-memory Duplexify pair that never emits
 * `close` after a clean two-way shutdown, unlike a TCP socket. `ws` would then keep
 * the server socket CLOSING until its 30 s fallback timer. Destroying the stream once
 * both directions have ended reproduces what the kernel does for a real connection.
 */
function emulateTcpClose(socket: WebSocket): void {
  const stream = (socket as unknown as { _socket: Duplex })._socket
  let pending = 2
  const onHalfClosed = () => {
    pending -= 1
    if (pending === 0) stream.destroy()
  }
  stream.once('end', onHalfClosed)
  stream.once('finish', onHalfClosed)
}

function newServerSocket(server: TestServer, before: Set<WebSocket>): WebSocket {
  const created = [...server.app.websocketServer.clients].filter((socket) => !before.has(socket))
  if (created.length !== 1) throw new Error(`Expected 1 new server socket, got ${created.length}`)
  const socket = created[0] as WebSocket
  emulateTcpClose(socket)
  return socket
}

/** Opens `/ws` as a guest (`user` null) or with the user's Better Auth session cookie. */
export async function connect(
  server: TestServer,
  user: TestUser | null = null,
  headers: Record<string, string> = user?.headers ?? {}
): Promise<RealtimeSession> {
  const before = new Set(server.app.websocketServer.clients as Set<WebSocket>)
  let next!: () => Promise<ServerMessage>
  const client = await server.app.injectWS(
    '/ws',
    { headers },
    {
      onInit: (socket) => {
        next = createInbox(socket)
        // injectWS constructs ws with address=null and omits autoPong. Real browsers
        // answer control pings automatically; reproduce that transport behavior.
        socket.on('ping', (data: Buffer) => socket.pong(data))
      },
    }
  )
  const serverSocket = newServerSocket(server, before)
  const protocol = protocolMessageSchema.parse(await next())
  const send = (message: unknown) => client.send(JSON.stringify(message))

  const drain = async () => {
    // Let frames sent through the in-memory stream reach the server first.
    await new Promise<void>((resolve) => setImmediate(resolve))
    await server.app.realtime.drain()
    send({ type: 'ping' })
    const received: ServerMessage[] = []
    for (let message = await next(); message.type !== 'pong'; message = await next()) {
      received.push(message)
    }
    return received
  }

  return {
    protocol,
    client,
    server: serverSocket,
    send,
    sendRaw: (data) => client.send(data),
    next,
    drain,
    serverClosed: closeInfo(serverSocket),
    clientClosed: closeInfo(client),
  }
}

/** Sends `join_room` and waits for the authoritative snapshot (fails on any other reply). */
export async function joinRoomChannel(
  session: RealtimeSession,
  roomCode: string
): Promise<ServerMessage> {
  session.send({ type: 'join_room', payload: { roomCode } })
  const reply = await session.next()
  if (reply.type !== 'room_snapshot') {
    throw new Error(`Expected room_snapshot, got ${JSON.stringify(reply)}`)
  }
  return reply
}

export async function subscribeCatalog(session: RealtimeSession): Promise<void> {
  session.send({ type: 'subscribe_lobby' })
  const reply = await session.next()
  if (reply.type !== 'lobby_subscribed') {
    throw new Error(`Expected lobby_subscribed, got ${JSON.stringify(reply)}`)
  }
}

/**
 * Read-only view of the plugin's in-memory subscription state, through the
 * decorated realtime module. Presence sweeps use the injected clock without sleeping.
 */
export function subscriptionState(server: TestServer) {
  const { inspect, operations, presence } = server.app.realtime

  return {
    catalogSubscribers: inspect.catalogSubscribers,
    roomSockets: inspect.roomSockets,
    trackedRooms: inspect.trackedRooms,
    sweepPresence: () => operations.run(() => presence.sweep()),
  }
}
