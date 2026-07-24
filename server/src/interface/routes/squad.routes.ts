import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { publicRecruitingSquadSchema } from '@squadzr/schemas'
import { createSquadController } from '@interface/factories/squad.factory'

const squadCodeParamsSchema = z.object({ code: z.string().length(6) })

const errorResponse = z.object({
  error: z.string(),
  message: z.string(),
})

export async function squadRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const squadController = createSquadController(fastify.db)

  app.get('/api/squads', {
    schema: {
      tags: ['Squads'],
      summary: 'List Recruiting Squads',
      description: 'Returns public Recruiting Squads that can still accept Memberships.',
      response: {
        200: z.object({ squads: z.array(publicRecruitingSquadSchema) }),
      },
    },
    handler: squadController.list.bind(squadController),
  })

  app.get('/api/squads/:code', {
    schema: {
      tags: ['Squads'],
      summary: 'Get public Recruiting Squad',
      description: 'Returns the public projection of one Recruiting Squad by its code.',
      params: squadCodeParamsSchema,
      response: {
        200: z.object({ squad: publicRecruitingSquadSchema }),
        404: errorResponse,
      },
    },
    handler: squadController.getPublic.bind(squadController),
  })
}
