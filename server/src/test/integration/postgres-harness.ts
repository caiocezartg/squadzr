import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

const { Pool } = pg

export interface PostgresVerification {
  engine: 'postgresql'
  serverVersionNumber: number
}

/**
 * A minimal, real database harness. It connects through pg directly and verifies
 * the server version, so integration tests cannot accidentally exercise mocks.
 */
export class PostgresIntegrationHarness {
  constructor(private readonly pool: pg.Pool) {}

  async verify(): Promise<PostgresVerification> {
    const result = await this.pool.query<{ server_version_num: string }>('SHOW server_version_num')
    const serverVersionNumber = Number(result.rows[0]?.server_version_num)

    if (!Number.isInteger(serverVersionNumber)) {
      throw new Error('The integration database did not identify itself as PostgreSQL')
    }

    return { engine: 'postgresql', serverVersionNumber }
  }

  async query<T extends pg.QueryResultRow>(statement: string): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(statement)
  }

  async migrate(): Promise<void> {
    const migrationsFolder = fileURLToPath(new URL('../../../drizzle/', import.meta.url))
    await migrate(drizzle(this.pool), { migrationsFolder })
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

export async function createPostgresIntegrationHarness(
  databaseUrl = process.env['SQUADZR_TEST_DATABASE_URL']
): Promise<PostgresIntegrationHarness> {
  if (!databaseUrl) {
    throw new Error('SQUADZR_TEST_DATABASE_URL must point to a disposable PostgreSQL database')
  }

  const harness = new PostgresIntegrationHarness(new Pool({ connectionString: databaseUrl }))

  try {
    await harness.verify()
    return harness
  } catch (error) {
    await harness.close()
    throw error
  }
}
