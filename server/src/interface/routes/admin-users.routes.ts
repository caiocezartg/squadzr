import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  adminUserParamsSchema,
  adminUserResponseSchema,
  adminUsersQuerySchema,
  adminUsersResponseSchema,
  changeUserRoleInputSchema,
  changeUserRoleResponseSchema,
  errorResponseSchema as errorResponse,
} from '@squadzr/schemas'
import { requireFullAdmin } from '@interface/hooks/admin.hook'
import { createAdminUsersController } from '@interface/factories/admin-users.factory'

export async function adminUsersRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const usersController = createAdminUsersController(
    fastify.db,
    fastify.clock,
    fastify.realtime.manager
  )

  app.get('/api/admin/users', {
    schema: {
      tags: ['Admin'],
      summary: 'List users',
      description:
        'Returns the users newest first, 20 per page. `q` matches a name by any part of it, or a Discord id or a user id exactly. Never carries an email. Requires the moderator, admin or owner role.',
      security: [{ session: [] }],
      querystring: adminUsersQuerySchema,
      response: {
        200: adminUsersResponseSchema,
        401: errorResponse,
        403: errorResponse,
      },
    },
    handler: usersController.list.bind(usersController),
  })

  app.get('/api/admin/users/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Get a user',
      description:
        'Returns what an admin needs to support a person: Discord id, joined date, role, online state, Squad Limits usage, current Open Squads, completed Squads count, Games count and the latest completed Squads. Never carries an email. Requires the moderator, admin or owner role.',
      security: [{ session: [] }],
      params: adminUserParamsSchema,
      response: {
        200: adminUserResponseSchema,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
      },
    },
    handler: usersController.get.bind(usersController),
  })

  app.put('/api/admin/users/:id/role', {
    preValidation: requireFullAdmin,
    schema: {
      tags: ['Admin'],
      summary: "Change a user's role",
      description:
        'Gives a user the role user, moderator or admin, with one `role_changed` Audit Entry. Nobody changes their own role (422 `CANNOT_CHANGE_OWN_ROLE`) or the owner role (422 `CANNOT_CHANGE_OWNER`); an admin changes only user and moderator accounts and the owner anyone else (otherwise 403 `ROLE_CHANGE_FORBIDDEN`); the same role is a no-op with no entry. Requires the admin or owner role.',
      security: [{ session: [] }],
      params: adminUserParamsSchema,
      body: changeUserRoleInputSchema,
      response: {
        200: changeUserRoleResponseSchema,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        422: errorResponse,
      },
    },
    handler: usersController.changeRole.bind(usersController),
  })
}
