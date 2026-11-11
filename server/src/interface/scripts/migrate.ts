import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { loadDatabaseEnv } from '@config/env'

const { Pool } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url))

/**
 * Applies the checked-in migrations with runtime dependencies only (no
 * `drizzle-kit`). Reads `DATABASE_URL` from the process environment and never
 * from a `.env` file: deploys inject the connection string. The pool is always
 * closed, and any failure exits non-zero.
 */
async function runMigrations(): Promise<void> {
  const { DATABASE_URL } = loadDatabaseEnv()
  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })
    console.log('Database migrations applied.')
  } finally {
    await pool.end()
  }
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
