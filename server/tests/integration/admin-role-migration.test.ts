import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import { databaseUrl, type PostgresHarnessContext } from '@test/harness/postgres'

// #117 data safety: migration 0010 adds the user role and the Audit Entry table. People who signed
// up before it become `user`, and the column refuses any other value.

const { Client } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))
// Pinned by tag: later migrations must not change which file this suite replays.
const ADMIN_MIGRATION = '0010_chunky_solo.sql'

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_FOLDER)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

function statementsOf(file: string): string[] {
  return readFileSync(join(MIGRATIONS_FOLDER, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

describe('admin role migration (#117)', () => {
  let admin: pg.Client
  let client: pg.Client
  let databaseName: string

  beforeEach(async () => {
    const runContext: PostgresHarnessContext = inject('postgres')
    databaseName = `${runContext.runId}_admin_${randomUUID().replaceAll('-', '').slice(0, 10)}`
    admin = new Client({ connectionString: runContext.adminUrl })
    await admin.connect()
    await admin.query(`CREATE DATABASE "${databaseName}"`)
    client = new Client({ connectionString: databaseUrl(runContext.adminUrl, databaseName) })
    await client.connect()
  })

  afterEach(async () => {
    await client.end()
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
    await admin.end()
  })

  async function applyBeforeAdminMigration(): Promise<void> {
    const files = migrationFiles()
    const index = files.indexOf(ADMIN_MIGRATION)
    expect(index).toBeGreaterThanOrEqual(0)
    for (const file of files.slice(0, index)) {
      for (const statement of statementsOf(file)) await client.query(statement)
    }
  }

  async function applyAdminMigration(): Promise<void> {
    for (const statement of statementsOf(ADMIN_MIGRATION)) await client.query(statement)
  }

  async function insertUser(id: string): Promise<void> {
    await client.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
      id,
      id,
      `${id}@squadzr.test`,
    ])
  }

  it('turns every existing user into a user and defaults new ones to it', async () => {
    await applyBeforeAdminMigration()
    await insertUser('before-1')
    await insertUser('before-2')

    await applyAdminMigration()
    await insertUser('after')

    const { rows } = await client.query<{ id: string; role: string }>(
      'SELECT id, role FROM "user" ORDER BY id'
    )
    expect(rows).toEqual([
      { id: 'after', role: 'user' },
      { id: 'before-1', role: 'user' },
      { id: 'before-2', role: 'user' },
    ])
  })

  it('refuses a role other than user or admin, and a missing one', async () => {
    await applyBeforeAdminMigration()
    await applyAdminMigration()

    await expect(
      client.query(
        `INSERT INTO "user" (id, name, email, role) VALUES ('x', 'x', 'x@x.test', 'root')`
      )
    ).rejects.toThrow(/user_role_in_enum/)
    await expect(
      client.query(`INSERT INTO "user" (id, name, email, role) VALUES ('y', 'y', 'y@y.test', NULL)`)
    ).rejects.toThrow(/null value/)
  })

  it('refuses an audit action the panel does not know', async () => {
    await applyBeforeAdminMigration()
    await applyAdminMigration()

    await expect(
      client.query(`INSERT INTO "audit_entries" (action) VALUES ('user_banned')`)
    ).rejects.toThrow(/audit_entries_action_in_enum/)
  })
})
