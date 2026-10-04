import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { REALTIME_PROTOCOL_VERSION } from '@squadzr/schemas/ws'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import { AppError } from '@application/errors'
import { parseIncomingMessage } from './incoming-message'
import { InvalidMessages, INVALID_MESSAGE_LIMIT } from './invalid-messages'
import type { Realtime, WsClient, WsIncomingMessage } from './types'
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
  }
}

async function wsPlugin(
  fastify: FastifyInstance,
  { realtime }: { realtime: Realtime }
): Promise<void> {
  const { manager, heartbeat, operations, presence, broadcaster, snapshots } = realtime
  fastify.decorate('broadcaster', broadcaster)

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

  fastify.get('/ws', { websocket: true }, (socket, request) => {
    const client: WsClient = {
      userId: request.session?.user?.id ?? null,
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

    function dispatch(message: WsIncomingMessage): void | Promise<void> {
      switch (message.type) {
        case 'join_room':
          return handleJoinRoom(socket, message, manager, snapshots, presence, broadcaster)
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
      void operations.run(async () => {
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
