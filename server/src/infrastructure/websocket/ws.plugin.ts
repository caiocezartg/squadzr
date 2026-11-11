import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { REALTIME_PROTOCOL_VERSION, type WsIncomingMessage } from '@squadzr/schemas/ws'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import { AppError } from '@application/errors'
import { AddressConnections } from './address-connections'
import { parseIncomingMessage } from './incoming-message'
import { InvalidMessages, INVALID_MESSAGE_LIMIT } from './invalid-messages'
import { MessageRate, PING_RATE_LIMIT } from './message-rate'
import type { Realtime, WsClient } from './types'
import {
  handleJoinRoom,
  handleLeaveRoom,
  handleSubscribeLobby,
  handleUnsubscribeLobby,
  sendError,
} from './handlers/room.handler'

declare module 'fastify' {
  interface FastifyInstance {
    broadcaster: IRoomBroadcaster
    realtime: Realtime
  }
}

export const SOCKET_OPERATION_LIMIT = 8

/** What one client address may do with the socket route. A limit of 0 is no limit. */
export interface WsLimits {
  /** Upgrades one address may start per minute. */
  readonly upgradesPerMinute: number
  /** Sockets one address may hold open at once. */
  readonly connectionsPerAddress: number
}

const UPGRADE_WINDOW_MS = 60_000
/** Close code 1013, "try again later". */
const WS_TRY_AGAIN_LATER = 1013

async function wsPlugin(
  fastify: FastifyInstance,
  { realtime, limits }: { realtime: Realtime; limits: WsLimits }
): Promise<void> {
  const addressConnections = new AddressConnections(limits.connectionsPerAddress)
  const { manager, heartbeat, operations, presence, broadcaster, subscribeSnapshot } = realtime
  fastify.decorate('broadcaster', broadcaster)
  fastify.decorate('realtime', realtime)

  const maintenance = setInterval(() => {
    void realtime
      .sweep()
      .catch(() =>
        fastify.log.error(
          { category: 'transport', event: 'maintenance_failed' },
          'Realtime maintenance failed'
        )
      )
  }, 1_000)
  maintenance.unref()
  fastify.addHook('preClose', async () => {
    clearInterval(maintenance)
    await realtime.shutdown()
  })

  // The upgrade is an HTTP request, so it also counts against the per-address limit every route has; this
  // one is tighter, because a real client opens one socket and keeps it.
  const upgradeLimit =
    limits.upgradesPerMinute > 0
      ? { rateLimit: { max: limits.upgradesPerMinute, timeWindow: UPGRADE_WINDOW_MS } }
      : undefined

  fastify.get('/ws', { websocket: true, config: upgradeLimit }, (socket, request) => {
    const address = request.ip
    if (!addressConnections.acquire(address)) {
      fastify.log.warn(
        { category: 'transport', event: 'connection_limit', limit: limits.connectionsPerAddress },
        'WebSocket connection limit exceeded'
      )
      socket.close(WS_TRY_AGAIN_LATER, 'Too many connections')
      return
    }
    let released = false
    const release = () => {
      if (released) return
      released = true
      addressConnections.release(address)
    }
    socket.on('close', release)

    const client: WsClient = {
      userId: request.session?.user?.id ?? null,
      sessionId: request.session?.session?.id ?? null,
      userName: null,
      userImage: null,
      roomCode: null,
      isInLobby: false,
      send: (message) => manager.sendToSocket(socket, message),
    }
    manager.setClientData(socket, client)
    if (client.userId) manager.addUserSocket(client.userId, socket)
    heartbeat.add(socket)
    fastify.log.info(
      { category: 'transport', event: 'connected', connectionCount: manager.connectionCount },
      'WebSocket connected'
    )
    client.send({
      type: 'protocol',
      timestamp: fastify.clock.now().getTime(),
      payload: { version: REALTIME_PROTOCOL_VERSION },
    })
    const invalid = new InvalidMessages(fastify.clock)
    const rate = new MessageRate(fastify.clock)
    const pingRate = new MessageRate(fastify.clock, PING_RATE_LIMIT)
    // A socket that keeps sending past its rate is looping, not lagging: it is closed like one that keeps
    // sending invalid frames.
    const refused = new InvalidMessages(fastify.clock)
    let inFlight = 0

    function dispatch(message: WsIncomingMessage): void | Promise<void> {
      switch (message.type) {
        case 'join_room':
          return handleJoinRoom(socket, message, manager, subscribeSnapshot, presence, broadcaster)
        case 'leave_room':
          if (!client.userId) {
            sendError(socket, 'UNAUTHORIZED', 'Authentication required', manager, fastify.clock)
            return
          }
          return handleLeaveRoom(socket, message, manager, presence)
        case 'subscribe_lobby':
          return handleSubscribeLobby(socket, manager, fastify.clock)
        case 'unsubscribe_lobby':
          return handleUnsubscribeLobby(socket, manager)
        case 'ping':
          client.send({ type: 'pong', timestamp: fastify.clock.now().getTime() })
      }
    }

    socket.on('message', (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      if (socket.readyState !== socket.OPEN) return
      // Validate immediately so even a busy subscription cannot postpone enforcement.
      const parsed = parseIncomingMessage(rawData)
      if (!parsed.ok) {
        const invalidCount = invalid.record()
        fastify.log.warn(
          {
            category: 'transport',
            event: 'invalid_message',
            code: parsed.code,
            issues: parsed.issues,
            invalidCount,
          },
          'Invalid WebSocket message'
        )
        sendError(socket, parsed.code, parsed.reason, manager, fastify.clock)
        if (invalidCount >= INVALID_MESSAGE_LIMIT) socket.close(1008, 'Too many invalid messages')
        return
      }
      if (parsed.message.type === 'ping') {
        // A ping past its rate gets no pong, so a flood cannot double itself into outbound frames.
        if (pingRate.allow()) dispatch(parsed.message)
        else if (refused.record() >= INVALID_MESSAGE_LIMIT) socket.close(1008, 'Too many messages')
        return
      }
      if (!rate.allow()) {
        fastify.log.warn(
          {
            category: 'transport',
            event: 'message_rate_limit',
            code: 'TOO_MANY_REQUESTS',
            connectionId: request.id,
            messageType: parsed.message.type,
          },
          'WebSocket message rate exceeded'
        )
        sendError(socket, 'TOO_MANY_REQUESTS', 'Too many messages', manager, fastify.clock)
        if (refused.record() >= INVALID_MESSAGE_LIMIT) socket.close(1008, 'Too many messages')
        return
      }
      if (inFlight >= SOCKET_OPERATION_LIMIT) {
        fastify.log.warn(
          {
            category: 'transport',
            event: 'operation_limit',
            code: 'TOO_MANY_REQUESTS',
            connectionId: request.id,
            messageType: parsed.message.type,
            inFlight,
            limit: SOCKET_OPERATION_LIMIT,
          },
          'WebSocket operation limit exceeded'
        )
        sendError(
          socket,
          'TOO_MANY_REQUESTS',
          'Too many pending operations',
          manager,
          fastify.clock
        )
        return
      }
      inFlight += 1
      const operation = async () => {
        if (
          realtime.isStopped() ||
          !manager.isConnected(socket) ||
          socket.readyState !== socket.OPEN
        )
          return
        try {
          await dispatch(parsed.message)
        } catch (error) {
          if (error instanceof AppError) {
            fastify.log.info(
              { category: 'membership', event: 'subscription_rejected', code: error.code },
              'WebSocket subscription rejected'
            )
            sendError(socket, error.code, error.message, manager, fastify.clock)
          } else {
            fastify.log.error(
              { category: 'transport', event: 'handler_failed' },
              'WebSocket message handling error'
            )
            sendError(socket, 'INTERNAL_ERROR', 'Failed to handle message', manager, fastify.clock)
          }
        }
      }
      const pending =
        parsed.message.type === 'join_room'
          ? broadcaster.scheduleSubscription(socket, parsed.message.payload.roomCode, operation)
          : operations.run(operation, socket)
      void pending.finally(() => {
        inFlight -= 1
      })
    })
    socket.on('pong', () => heartbeat.pong(socket))
    socket.on('close', () => realtime.disconnect(socket))
    socket.on('error', () => {
      fastify.log.warn(
        { category: 'transport', event: 'socket_error' },
        'WebSocket transport error'
      )
      realtime.disconnect(socket)
    })
  })
}

export default fp(wsPlugin, {
  name: 'websocket-handler',
  fastify: '5.x',
  dependencies: ['@fastify/websocket'],
})
