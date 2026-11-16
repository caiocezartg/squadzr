import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { requireAuth } from '@interface/hooks/auth.hook'
import { createChatController } from '@interface/factories/chat.factory'
import {
  chatHistoryResponseSchema,
  chatMessageSchema,
  errorResponseSchema as errorResponse,
  roomCodeParamSchema,
  sendChatMessageRequestSchema,
} from '@squadzr/schemas'

export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const chatController = createChatController(fastify.db, fastify.clock)

  app.get('/api/rooms/:code/messages', {
    schema: {
      tags: ['Chat'],
      summary: 'List Squad Chat messages',
      description:
        'Returns the latest 50 messages of a Squad Chat, oldest first, and whether older ones exist. Only members of the Squad can read it. Requires authentication.',
      security: [{ session: [] }],
      params: roomCodeParamSchema,
      response: {
        200: chatHistoryResponseSchema,
        401: errorResponse,
        404: errorResponse,
        422: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: chatController.list.bind(chatController),
  })

  app.post('/api/rooms/:code/messages', {
    schema: {
      tags: ['Chat'],
      summary: 'Send a Squad Chat message',
      description:
        'Stores a message of a member in the Squad Chat. The client generates the message id, so a retry of the same id returns the stored message with 200 instead of 201. An id that belongs to another author or Squad answers 409. The body is trimmed and holds 1 to 500 characters and at most 10 line breaks. Requires authentication.',
      security: [{ session: [] }],
      params: roomCodeParamSchema,
      body: sendChatMessageRequestSchema,
      response: {
        200: chatMessageSchema,
        201: chatMessageSchema,
        401: errorResponse,
        404: errorResponse,
        409: errorResponse,
        422: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: chatController.send.bind(chatController),
  })
}
