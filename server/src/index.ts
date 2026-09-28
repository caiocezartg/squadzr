// Production entry point: the only module that starts a listener. Everything it
// wires lives in `./app`, which is side-effect free and safe to import in tests.
import { loadEnv } from '@config/env'
import { buildApp } from './app'

async function start(): Promise<void> {
  const env = loadEnv()
  const server = await buildApp({ env })

  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`)
    await server.close()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  try {
    await server.listen({
      port: env.PORT,
      host: env.HOST,
    })

    server.log.info(`Server running at http://${env.HOST}:${env.PORT}`)
  } catch (error) {
    server.log.error(error)
    process.exit(1)
  }
}

start()
