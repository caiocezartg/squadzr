import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import { databaseUrl, type PostgresHarnessContext } from '@test/harness/postgres'

// #118 data safety: migration 0012 widens the user role to user, moderator, admin and owner, and
// allows at most one owner. Roles that existed before it stay as they are.

const { Client } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))
// Pinned by tag: later migrations must not change which file this suite replays.
const ROLES_MIGRATION = '0012_owner_moderator_roles.sql'

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

describe('owner and moderator roles migration (#118)', () => {
  let admin: pg.Client
  let client: pg.Client
  let databaseName: string

  beforeEach(async () => {
    const runContext: PostgresHarnessContext = inject('postgres')
    databaseName = `${runContext.runId}_roles_${randomUUID().replaceAll('-', '').slice(0, 10)}`
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

  async function applyBeforeRolesMigration(): Promise<void> {
    const files = migrationFiles()
    const index = files.indexOf(ROLES_MIGRATION)
    expect(index).toBeGreaterThanOrEqual(0)
    for (const file of files.slice(0, index)) {
      for (const statement of statementsOf(file)) await client.query(statement)
    }
  }

  async function applyRolesMigration(): Promise<void> {
    for (const statement of statementsOf(ROLES_MIGRATION)) await client.query(statement)
  }

  async function insertUser(id: string, role = 'user'): Promise<void> {
    await client.query('INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, $4)', [
      id,
      id,
      `${id}@squadzr.test`,
      role,
    ])
  }

  it('keeps the roles people already had', async () => {
    await applyBeforeRolesMigration()
    await insertUser('plain')
    await insertUser('boss', 'admin')

    await applyRolesMigration()

    const { rows } = await client.query<{ id: string; role: string }>(
      'SELECT id, role FROM "user" ORDER BY id'
    )
    expect(rows).toEqual([
      { id: 'boss', role: 'admin' },
      { id: 'plain', role: 'user' },
    ])
  })

  it('accepts moderator and owner and still refuses any other role', async () => {
    await applyBeforeRolesMigration()
    await applyRolesMigration()

    await insertUser('mod', 'moderator')
    await insertUser('chief', 'owner')

    await expect(insertUser('x', 'root')).rejects.toThrow(/user_role_in_enum/)
  })

  it('allows at most one owner, while admins and moderators stay unlimited', async () => {
    await applyBeforeRolesMigration()
    await applyRolesMigration()
    await insertUser('chief', 'owner')
    await insertUser('admin-1', 'admin')
    await insertUser('admin-2', 'admin')
    await insertUser('mod-1', 'moderator')
    await insertUser('mod-2', 'moderator')

    await expect(insertUser('second-chief', 'owner')).rejects.toThrow(/user_single_owner_idx/)
    await insertUser('plain')
    await expect(
      client.query(`UPDATE "user" SET role = 'owner' WHERE id = 'plain'`)
    ).rejects.toThrow(/user_single_owner_idx/)
  })
})
