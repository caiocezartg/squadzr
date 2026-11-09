import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import type { CatalogImportExecutor } from '@infrastructure/services/catalog-import-executor'

declare module 'fastify' {
  interface FastifyInstance {
    /** What a request needs of the executor: whether one exists, and a nudge to look for a queued run. */
    catalogImportExecutor: {
      readonly enabled: boolean
      wake(): void
    }
  }
}

export interface CatalogImportExecutorPluginOptions {
  /** Built by the composition root; null when the API has no IGDB credentials. */
  readonly executor: CatalogImportExecutor | null
}

/**
 * Runs the executor with the app: it looks for a queued run at boot and on a short poll, and stops with
 * the server so no timer outlives `app.close()`. Without an executor the decoration is inert.
 */
async function catalogImportExecutorPlugin(
  fastify: FastifyInstance,
  { executor }: CatalogImportExecutorPluginOptions
): Promise<void> {
  fastify.decorate('catalogImportExecutor', {
    enabled: executor !== null,
    wake: () => executor?.wake(),
  })

  if (!executor) return

  fastify.addHook('onReady', () => {
    executor.start()
  })

  fastify.addHook('onClose', async () => {
    await executor.stop()
  })
}

export default fp(catalogImportExecutorPlugin, {
  name: 'catalog-import-executor',
  dependencies: ['database'],
})
