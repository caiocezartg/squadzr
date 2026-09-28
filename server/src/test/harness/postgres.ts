import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const { Client, Pool } = pg

const REQUIRED_POSTGRES_MAJOR = 16
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url))
// Serializes CREATE DATABASE ... TEMPLATE across test workers: PostgreSQL rejects
// concurrent clones while the template is being accessed by another session.
const CLONE_LOCK_KEY = 290_029

const DEFAULT_ADMIN_URL = 'postgresql://postgres:postgres@localhost:5433/postgres'

export interface PostgresHarnessContext {
  adminUrl: string
  runId: string
  templateDatabase: string
}

export interface IsolatedDatabase {
  name: string
  url: string
  drop: () => Promise<void>
}

/** Admin connection (maintenance database) of the PostgreSQL 16 test server. */
export function readAdminUrl(source: Record<string, string | undefined> = process.env): string {
  return z.url().default(DEFAULT_ADMIN_URL).parse(source['TEST_DATABASE_URL'])
}

export function databaseUrl(adminUrl: string, database: string): string {
  const url = new URL(adminUrl)
  url.pathname = `/${database}`
  return url.toString()
}

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`

async function withAdminClient<T>(
  adminUrl: string,
  run: (client: pg.Client) => Promise<T>
): Promise<T> {
  const client = new Client({ connectionString: adminUrl })
  await client.connect()
  try {
    return await run(client)
  } finally {
    await client.end()
  }
}

async function assertPostgresVersion(client: pg.Client): Promise<void> {
  const { rows } = await client.query<{ server_version_num: string }>('SHOW server_version_num')
  const major = Math.floor(Number(rows[0]?.server_version_num) / 10_000)

  if (major !== REQUIRED_POSTGRES_MAJOR) {
    throw new Error(
      `Integration tests require PostgreSQL ${REQUIRED_POSTGRES_MAJOR}, but the server reports ${major}.`
    )
  }
}

async function applyMigrations(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url })
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })
  } finally {
    await pool.end()
  }
}

/**
 * Creates a migrated template database for one test run. Every test then clones it,
 * so migrations run once and each test starts from the same clean schema.
 */
export async function createTemplateDatabase(adminUrl: string): Promise<PostgresHarnessContext> {
  const runId = `squadzr_test_${Date.now().toString(36)}_${process.pid}`
  const templateDatabase = `${runId}_template`

  await withAdminClient(adminUrl, async (client) => {
    await assertPostgresVersion(client)
    await client.query(`CREATE DATABASE ${quote(templateDatabase)}`)
  })

  try {
    await applyMigrations(databaseUrl(adminUrl, templateDatabase))
  } catch (error) {
    await dropRunDatabases({ adminUrl, runId, templateDatabase })
    throw error
  }

  return { adminUrl, runId, templateDatabase }
}

/** Clones the run's template into a fresh database owned by a single test. */
export async function createIsolatedDatabase(
  context: PostgresHarnessContext
): Promise<IsolatedDatabase> {
  const name = `${context.runId}_${randomUUID().replaceAll('-', '').slice(0, 12)}`

  await withAdminClient(context.adminUrl, async (client) => {
    await client.query('SELECT pg_advisory_lock($1)', [CLONE_LOCK_KEY])
    try {
      await client.query(
        `CREATE DATABASE ${quote(name)} TEMPLATE ${quote(context.templateDatabase)}`
      )
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [CLONE_LOCK_KEY])
    }
  })

  return {
    name,
    url: databaseUrl(context.adminUrl, name),
    drop: () =>
      withAdminClient(context.adminUrl, async (client) => {
        await client.query(`DROP DATABASE IF EXISTS ${quote(name)}`)
      }),
  }
}

/** Drops the template and any database a crashed test left behind for this run. */
export async function dropRunDatabases(context: PostgresHarnessContext): Promise<void> {
  await withAdminClient(context.adminUrl, async (client) => {
    const { rows } = await client.query<{ datname: string }>(
      'SELECT datname FROM pg_database WHERE starts_with(datname, $1)',
      [`${context.runId}_`]
    )
    for (const { datname } of rows) {
      await client.query(`DROP DATABASE IF EXISTS ${quote(datname)} WITH (FORCE)`)
    }
  })
}
