import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { createDatabase, type Database } from '@infrastructure/database/drizzle'

declare module 'fastify' {
  interface FastifyInstance {
    db: Database
  }
}

export interface DatabasePluginOptions {
  connectionString: string
}

async function databasePlugin(
  fastify: FastifyInstance,
  options: DatabasePluginOptions
): Promise<void> {
  const { db, close } = createDatabase(options.connectionString)

  fastify.decorate('db', db)

  fastify.addHook('onClose', async () => {
    await close()
  })
}

export default fp(databasePlugin, {
  name: 'database',
  fastify: '5.x',
})
