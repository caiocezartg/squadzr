import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import { databaseUrl, type PostgresHarnessContext } from '@test/harness/postgres'

// #112 data safety: replays the migration chain up to 0007 on a real PostgreSQL database,
// seeds notifications, applies 0008 and proves the old rows survive, the idempotency key now
// covers only `room_ready` and the other types may repeat.

const { Client } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))
// Pinned by tag: later migrations must not change which file this suite replays.
const PARTIAL_INDEX_MIGRATION = '0008_wandering_tarantula.sql'
const UNIQUE_VIOLATION = '23505'

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_FOLDER)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

async function applyMigration(client: pg.Client, file: string): Promise<void> {
  const statements = readFileSync(join(MIGRATIONS_FOLDER, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
  for (const statement of statements) await client.query(statement)
}

describe('notification idempotency key migration (#112)', () => {
  let admin: pg.Client
  let client: pg.Client
  let databaseName: string

  beforeEach(async () => {
    const runContext: PostgresHarnessContext = inject('postgres')
    databaseName = `${runContext.runId}_notif_${randomUUID().replaceAll('-', '').slice(0, 10)}`
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

  async function insertNotification(userId: string, roomId: string, type: string) {
    await client.query(
      `INSERT INTO "user_notifications" (user_id, room_id, type, title, message)
       VALUES ($1, $2, $3, 'Title', 'Message')`,
      [userId, roomId, type]
    )
  }

  it('keeps the existing notifications and limits the unique key to room_ready', async () => {
    const files = migrationFiles()
    const index = files.indexOf(PARTIAL_INDEX_MIGRATION)
    expect(index).toBeGreaterThanOrEqual(0)
    for (const file of files.slice(0, index)) await applyMigration(client, file)

    const suffix = randomUUID().slice(0, 8)
    const userId = `user-${suffix}`
    const roomId = randomUUID()
    await client.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
      userId,
      'Migration User',
      `migration-${suffix}@squadzr.test`,
    ])
    await insertNotification(userId, roomId, 'room_ready')
    await insertNotification(userId, randomUUID(), 'room_ready')
    await expect(insertNotification(userId, roomId, 'room_ready')).rejects.toMatchObject({
      code: UNIQUE_VIOLATION,
    })

    await applyMigration(client, PARTIAL_INDEX_MIGRATION)

    const { rows: kept } = await client.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM "user_notifications"'
    )
    expect(kept[0]?.total).toBe(2)

    // The key still makes room_ready idempotent...
    await expect(insertNotification(userId, roomId, 'room_ready')).rejects.toMatchObject({
      code: UNIQUE_VIOLATION,
    })
    // ...and no other type has one: a host is told twice about the same Squad.
    for (const type of ['member_left', 'host_transferred', 'room_closed', 'room_closed_by_admin']) {
      await insertNotification(userId, roomId, type)
      await insertNotification(userId, roomId, type)
    }
    const { rows: repeated } = await client.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM "user_notifications" WHERE type <> 'room_ready'`
    )
    expect(repeated[0]?.total).toBe(8)

    const { rows: indexes } = await client.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'user_notifications_room_user_type_unique'`
    )
    expect(indexes).toHaveLength(1)
    expect(indexes[0]?.indexdef).toContain('UNIQUE INDEX')
    expect(indexes[0]?.indexdef).toMatch(/WHERE .*type.* = 'room_ready'/)
  })
})
