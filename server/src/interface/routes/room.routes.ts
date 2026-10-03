import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { requireAuth } from '@interface/hooks/auth.hook'
import { createRoomController } from '@interface/factories/room.factory'
import { createGameController } from '@interface/factories/game.factory'
import {
  createRoomInputSchema,
  createRoomResponseSchema,
  errorResponseSchema as errorResponse,
  gameResponseSchema,
  gamesResponseSchema,
  joinRoomResponseSchema,
  leaveRoomResponseSchema,
  myRoomsResponseSchema,
  roomResponseSchema,
  roomsResponseSchema,
} from '@squadzr/schemas'
import { roomCodeParamSchema, gameIdParamSchema } from '@application/dtos'

export async function roomRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const roomController = createRoomController(fastify.db, fastify.broadcaster)
  const gameController = createGameController(fastify.db)

  // Games
  app.get('/api/games', {
    schema: {
      tags: ['Games'],
      summary: 'List all games',
      description: 'Returns the catalog of all supported games.',
      response: {
        200: gamesResponseSchema,
      },
    },
    handler: gameController.list.bind(gameController),
  })

  app.get('/api/games/:id', {
    schema: {
      tags: ['Games'],
      summary: 'Get game by ID',
      description: 'Returns a single game by its UUID.',
      params: gameIdParamSchema,
      response: {
        200: gameResponseSchema,
        404: errorResponse,
      },
    },
    handler: gameController.getById.bind(gameController),
  })

  // Rooms
  app.get('/api/rooms', {
    schema: {
      tags: ['Rooms'],
      summary: 'List available rooms',
      description:
        'Returns all rooms with "waiting" status that can be joined, as the public projection: no Discord invite and no roster.',
      response: {
        200: roomsResponseSchema,
      },
    },
    handler: roomController.list.bind(roomController),
  })

  app.get('/api/rooms/my', {
    schema: {
      tags: ['Rooms'],
      summary: 'Get my rooms',
      description:
        'Returns rooms created by or joined by the authenticated user, grouped into hosted and joined.',
      security: [{ session: [] }],
      response: {
        200: myRoomsResponseSchema,
        401: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: roomController.getMyRooms.bind(roomController),
  })

  app.get('/api/rooms/:code', {
    schema: {
      tags: ['Rooms'],
      summary: 'Get room by code',
      description:
        'Returns a specific room by its 6-character code. Authenticated members of the room also get its Discord invite and roster; everyone else gets the public projection.',
      params: roomCodeParamSchema,
      response: {
        200: roomResponseSchema,
        404: errorResponse,
      },
    },
    handler: roomController.getByCode.bind(roomController),
  })

  app.post('/api/rooms', {
    schema: {
      tags: ['Rooms'],
      summary: 'Create a room',
      description:
        'Creates a new room and adds the authenticated user as host. Requires authentication.',
      security: [{ session: [] }],
      body: createRoomInputSchema,
      response: {
        201: createRoomResponseSchema,
        400: errorResponse,
        401: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: roomController.create.bind(roomController),
  })

  app.post('/api/rooms/:code/join', {
    schema: {
      tags: ['Rooms'],
      summary: 'Join a room',
      description:
        'Joins an existing room by its code. Room must be in "waiting" status and not full. Requires authentication.',
      security: [{ session: [] }],
      params: roomCodeParamSchema,
      response: {
        200: joinRoomResponseSchema,
        401: errorResponse,
        404: errorResponse,
        422: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: roomController.join.bind(roomController),
  })

  app.post('/api/rooms/:code/leave', {
    schema: {
      tags: ['Rooms'],
      summary: 'Leave a room',
      description:
        'Leaves a room by its code. If the host leaves, the room is deleted. Requires authentication.',
      security: [{ session: [] }],
      params: roomCodeParamSchema,
      response: {
        200: leaveRoomResponseSchema,
        401: errorResponse,
        404: errorResponse,
        422: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: roomController.leave.bind(roomController),
  })
}
