import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import { databaseUrl, type PostgresHarnessContext } from '@test/harness/postgres'

// #117 data safety: migration 0011 makes the Audit Entry table append-only. An entry is written once;
// the only change it may take is losing its actor reference when that account is deleted.

const { Client } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))
// Pinned by tag: later migrations must not change which file this suite replays last.
const APPEND_ONLY_MIGRATION = '0011_audit_append_only.sql'
const APPEND_ONLY = /audit_entries is append-only/

function statementsOf(file: string): string[] {
  return readFileSync(join(MIGRATIONS_FOLDER, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

function migrationsThroughAppendOnly(): string[] {
  const files = readdirSync(MIGRATIONS_FOLDER)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  const index = files.indexOf(APPEND_ONLY_MIGRATION)
  expect(index).toBeGreaterThanOrEqual(0)
  return files.slice(0, index + 1)
}

describe('audit append-only migration (#117)', () => {
  let admin: pg.Client
  let client: pg.Client
  let databaseName: string

  beforeEach(async () => {
    const runContext: PostgresHarnessContext = inject('postgres')
    databaseName = `${runContext.runId}_audit_${randomUUID().replaceAll('-', '').slice(0, 10)}`
    admin = new Client({ connectionString: runContext.adminUrl })
    await admin.connect()
    await admin.query(`CREATE DATABASE "${databaseName}"`)
    client = new Client({ connectionString: databaseUrl(runContext.adminUrl, databaseName) })
    await client.connect()
    for (const file of migrationsThroughAppendOnly()) {
      for (const statement of statementsOf(file)) await client.query(statement)
    }
  })

  afterEach(async () => {
    await client.end()
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
    await admin.end()
  })

  async function insertUser(id: string): Promise<void> {
    await client.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
      id,
      id,
      `${id}@squadzr.test`,
    ])
  }

  async function insertEntry(actorId: string | null = null): Promise<string> {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO "audit_entries" (actor_id, actor_name, action, reason, details)
       VALUES ($1, 'Actor', 'role_changed', 'because', '{"from":"user","to":"admin"}')
       RETURNING id`,
      [actorId]
    )
    return rows[0]!.id
  }

  it('lets an entry be inserted', async () => {
    const id = await insertEntry()

    const { rows } = await client.query('SELECT id FROM "audit_entries"')
    expect(rows).toEqual([{ id }])
  })

  it('refuses to update an entry', async () => {
    const id = await insertEntry()

    await expect(
      client.query(`UPDATE "audit_entries" SET reason = 'rewritten' WHERE id = $1`, [id])
    ).rejects.toThrow(APPEND_ONLY)
    await expect(
      client.query(`UPDATE "audit_entries" SET action = 'squad_closed' WHERE id = $1`, [id])
    ).rejects.toThrow(APPEND_ONLY)
  })

  it('refuses to delete an entry', async () => {
    const id = await insertEntry()

    await expect(client.query(`DELETE FROM "audit_entries" WHERE id = $1`, [id])).rejects.toThrow(
      APPEND_ONLY
    )
    await expect(client.query(`DELETE FROM "audit_entries"`)).rejects.toThrow(APPEND_ONLY)

    const { rows } = await client.query('SELECT id FROM "audit_entries"')
    expect(rows).toEqual([{ id }])
  })

  it('keeps the entry, with its name snapshot, when its actor account is deleted', async () => {
    await insertUser('actor')
    const id = await insertEntry('actor')

    await client.query(`DELETE FROM "user" WHERE id = 'actor'`)

    const { rows } = await client.query('SELECT id, actor_id, actor_name FROM "audit_entries"')
    expect(rows).toEqual([{ id, actor_id: null, actor_name: 'Actor' }])
  })

  it('refuses to clear the actor together with any other change, or to point it elsewhere', async () => {
    await insertUser('actor')
    await insertUser('other')
    const id = await insertEntry('actor')

    await expect(
      client.query(`UPDATE "audit_entries" SET actor_id = NULL, reason = 'x' WHERE id = $1`, [id])
    ).rejects.toThrow(APPEND_ONLY)
    await expect(
      client.query(`UPDATE "audit_entries" SET actor_id = 'other' WHERE id = $1`, [id])
    ).rejects.toThrow(APPEND_ONLY)
  })
})
