import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { requireAuth } from '@interface/hooks/auth.hook'
import { createRoomController } from '@interface/factories/room.factory'
import { createGameController } from '@interface/factories/game.factory'
import {
  createRoomInputSchema,
  createRoomResponseSchema,
  discordPreviewResponseSchema,
  errorResponseSchema as errorResponse,
  gameIdParamSchema,
  gameResponseSchema,
  gamesQuerySchema,
  gamesResponseSchema,
  joinRoomResponseSchema,
  leaveRoomResponseSchema,
  myRoomsResponseSchema,
  popularGamesQuerySchema,
  popularGamesResponseSchema,
  roomCodeParamSchema,
  roomResponseSchema,
  roomsResponseSchema,
} from '@squadzr/schemas'

export async function roomRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const roomController = createRoomController(
    fastify.db,
    fastify.broadcaster,
    fastify.clock,
    fastify.discordPreviews
  )
  const gameController = createGameController(fastify.db, fastify.clock)

  // Games
  app.get('/api/games', {
    schema: {
      tags: ['Games'],
      summary: 'Search games',
      description:
        'Returns Listed Games whose name contains the search text, name-prefix matches first, then by popularity. Without a search it returns the most popular Listed Games.',
      querystring: gamesQuerySchema,
      response: {
        200: gamesResponseSchema,
      },
    },
    handler: gameController.list.bind(gameController),
  })

  app.get('/api/games/popular', {
    schema: {
      tags: ['Games'],
      summary: 'List popular games',
      description:
        'Returns the Listed Games with the most Open Squads right now, ranked by open Squads, featured rank, popularity and name. On a quiet day the Featured Games fill the list. Each entry carries the open count and up to three most used tags, and the response carries the total of Listed Games.',
      querystring: popularGamesQuerySchema,
      response: {
        200: popularGamesResponseSchema,
      },
    },
    handler: gameController.popular.bind(gameController),
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
        'Returns the Open Rooms that can still be joined, as the public projection: no Discord invite and no roster. Ready Rooms and expired Open Rooms are absent.',
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
        'Returns a specific room by its 6-character code. Authenticated members get the Discord invite and roster; everyone else gets the public projection for an Open Room. Ready Rooms answer only to their members during retention; expired rooms answer 404 to everyone.',
      params: roomCodeParamSchema,
      response: {
        200: roomResponseSchema,
        404: errorResponse,
      },
    },
    handler: roomController.getByCode.bind(roomController),
  })

  app.get('/api/rooms/:code/discord-preview', {
    schema: {
      tags: ['Rooms'],
      summary: 'Get the Discord server behind a Ready Room',
      description:
        'Returns the name, icon, backdrop and member counts of the Discord server the Ready Room invites to, read from Discord by the server and cached for ten minutes. The preview is null whenever Discord has nothing to show (invalid or expired invite, Discord down or rate limiting), so the caller falls back to the data of the Room itself. Only members of a Ready Room may ask. Requires authentication.',
      security: [{ session: [] }],
      params: roomCodeParamSchema,
      response: {
        200: discordPreviewResponseSchema,
        401: errorResponse,
        404: errorResponse,
        422: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: roomController.getDiscordPreview.bind(roomController),
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
        'Joins an existing Open Room by its code. The join verifies expiration, readiness and capacity in one transaction; a Ready Room rejects every Membership change. Requires authentication.',
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
