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
 * Every pooled connection runs in UTC: `timestamp` columns (such as `user.created_at`) hold a UTC wall
 * clock, and the session zone decides what their `now()` default writes.
 */
const SESSION_OPTIONS = '-c timezone=UTC'

/**
 * Opens a dedicated connection pool. Nothing is created at import time, so every
 * server instance (production or test) owns and closes its own pool.
 */
export function createDatabase(connectionString: string): DatabaseConnection {
  const pool = new Pool({ connectionString, options: SESSION_OPTIONS })

  return {
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  }
}
