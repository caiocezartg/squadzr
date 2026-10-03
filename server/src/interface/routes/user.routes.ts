import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { requireAuth } from '@interface/hooks/auth.hook'
import { createUserController } from '@interface/factories/user.factory'
import {
  errorResponseSchema as errorResponse,
  notificationChangeResponseSchema,
  notificationsResponseSchema,
  readAllNotificationsResponseSchema,
  userResponseSchema,
} from '@squadzr/schemas'
import { listNotificationsQuerySchema, notificationIdParamSchema } from '@application/dtos'

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const userController = createUserController(fastify.db)

  app.get('/api/users/me', {
    schema: {
      tags: ['Users'],
      summary: 'Get current user',
      description: 'Returns the authenticated user profile. Requires authentication.',
      security: [{ session: [] }],
      response: {
        200: userResponseSchema,
        401: errorResponse,
        404: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: userController.me.bind(userController),
  })

  app.get('/api/notifications', {
    schema: {
      tags: ['Users'],
      summary: 'List user notifications',
      description: 'Returns recent notifications for the authenticated user.',
      security: [{ session: [] }],
      querystring: listNotificationsQuerySchema,
      response: {
        200: notificationsResponseSchema,
        401: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: userController.listNotifications.bind(userController),
  })

  app.post('/api/notifications/:id/read', {
    schema: {
      tags: ['Users'],
      summary: 'Mark notification as read',
      description: 'Marks a notification as read for the authenticated user.',
      security: [{ session: [] }],
      params: notificationIdParamSchema,
      response: {
        200: notificationChangeResponseSchema,
        401: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: userController.markNotificationAsRead.bind(userController),
  })

  app.post('/api/notifications/read-all', {
    schema: {
      tags: ['Users'],
      summary: 'Mark all notifications as read',
      description: 'Marks all unread notifications as read for the authenticated user.',
      security: [{ session: [] }],
      response: {
        200: readAllNotificationsResponseSchema,
        401: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: userController.markAllNotificationsAsRead.bind(userController),
  })

  app.delete('/api/notifications/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Delete notification',
      description: 'Deletes a notification for the authenticated user.',
      security: [{ session: [] }],
      params: notificationIdParamSchema,
      response: {
        200: notificationChangeResponseSchema,
        401: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: userController.deleteNotification.bind(userController),
  })
}
