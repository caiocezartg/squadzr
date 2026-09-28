import type { GlobalSetupContext } from 'vitest/node'
import {
  createTemplateDatabase,
  dropRunDatabases,
  readAdminUrl,
  type PostgresHarnessContext,
} from './postgres'

declare module 'vitest' {
  export interface ProvidedContext {
    postgres: PostgresHarnessContext
  }
}

/** Vitest global setup for `server:integration`: one migrated template per run. */
export default async function setup({ provide }: GlobalSetupContext) {
  const context = await createTemplateDatabase(readAdminUrl())
  provide('postgres', context)

  return async () => {
    await dropRunDatabases(context)
  }
}
