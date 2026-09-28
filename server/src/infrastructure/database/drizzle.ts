import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

const { Pool } = pg

export type Database = NodePgDatabase<typeof schema>

export interface DatabaseConnection {
  db: Database
  close: () => Promise<void>
}

/**
 * Opens a dedicated connection pool. Nothing is created at import time, so every
 * server instance (production or test) owns and closes its own pool.
 */
export function createDatabase(connectionString: string): DatabaseConnection {
  const pool = new Pool({ connectionString })

  return {
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  }
}
