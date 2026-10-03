import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleRoomMemberRepository } from '@infrastructure/repositories/drizzle-room-member.repository'
import { DrizzleUserRepository } from '@infrastructure/repositories/drizzle-user.repository'
import { WsConnectionManager } from './ws-connection-manager'
import { WsRoomBroadcaster } from './room-broadcaster.service'
import { parseIncomingMessage } from './incoming-message'
import type { PongMessage, WsClient, WsServerMessage } from './types'
import {
  handleJoinRoom,
  handleLeaveRoom,
  handleDisconnect,
  handleSubscribeLobby,
  handleUnsubscribeLobby,
  sendError,
} from './handlers/room.handler'

declare module 'fastify' {
  interface FastifyInstance {
    broadcaster: IRoomBroadcaster
  }
}

async function wsPlugin(fastify: FastifyInstance): Promise<void> {
  const connectionManager = new WsConnectionManager()
  const broadcaster = new WsRoomBroadcaster(connectionManager)

  fastify.decorate('broadcaster', broadcaster)

  fastify.get('/ws', { websocket: true }, async (socket: WebSocket, request: FastifyRequest) => {
    fastify.log.info(
      {
        hasSession: !!request.session,
        sessionUser: request.session?.user?.id,
      },
      'WebSocket connection attempt'
    )

    // Session is already populated by auth.plugin.ts preHandler hook
    const session = request.session

    if (!session?.user?.id) {
      fastify.log.info('WebSocket connected as guest (lobby-only)')
    } else {
      fastify.log.info({ userId: session.user.id }, 'WebSocket authenticated')
    }

    const client: WsClient = {
      userId: session?.user?.id ?? null,
      userName: session?.user?.name ?? null,
      userImage: session?.user?.image ?? null,
      roomCode: null,
      isInLobby: false,
      send: (message: WsServerMessage) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(message))
        }
      },
    }

    connectionManager.setClientData(socket, client)
    if (client.userId) {
      connectionManager.addUserSocket(client.userId, socket)
    }

    const db = fastify.db
    const roomRepository = new DrizzleRoomRepository(db)
    const roomMemberRepository = new DrizzleRoomMemberRepository(db)
    const userRepository = new DrizzleUserRepository(db)

    socket.on('message', async (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      const parsed = parseIncomingMessage(rawData)
      if (!parsed.ok) {
        fastify.log.warn({ code: parsed.code, issues: parsed.issues }, 'Invalid WebSocket message')
        sendError(socket, parsed.code, parsed.reason)
        return
      }

      const { message } = parsed

      try {
        switch (message.type) {
          case 'join_room':
            await handleJoinRoom(
              socket,
              message,
              connectionManager,
              roomRepository,
              roomMemberRepository,
              userRepository,
              fastify.clock
            )
            break
          case 'leave_room':
            await handleLeaveRoom(socket, message, connectionManager)
            break
          case 'subscribe_lobby':
            handleSubscribeLobby(socket, connectionManager)
            break
          case 'unsubscribe_lobby':
            handleUnsubscribeLobby(socket, connectionManager)
            break
          case 'ping': {
            const pongMessage: PongMessage = {
              type: 'pong',
              timestamp: Date.now(),
            }
            client.send(pongMessage)
            break
          }
        }
      } catch (error) {
        fastify.log.error(error, 'WebSocket message handling error')
        sendError(socket, 'PARSE_ERROR', 'Failed to parse message')
      }
    })

    const cleanup = () => {
      const clientData = connectionManager.getClientData(socket)
      if (clientData?.userId) {
        connectionManager.removeUserSocket(clientData.userId, socket)
      }
      handleDisconnect(socket, connectionManager)
    }

    socket.on('close', cleanup)

    socket.on('error', (error: Error) => {
      fastify.log.error(error, 'WebSocket error')
      cleanup()
    })
  })
}

export default fp(wsPlugin, {
  name: 'websocket-handler',
  fastify: '5.x',
  dependencies: ['@fastify/websocket'],
})
