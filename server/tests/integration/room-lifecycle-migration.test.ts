import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import { databaseUrl, type PostgresHarnessContext } from '@test/harness/postgres'

// CCC-35 data safety: replays the whole migration chain on a real PostgreSQL
// database — the three migrations that produced the current schema, seed rows
// for users/accounts/sessions plus disposable room data, then the lifecycle
// migration. It proves auth data survives, disposable rows are deleted on
// purpose, and the new schema and idempotency index are in place.

const { Client } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_FOLDER)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

function statements(sqlFile: string): string[] {
  return readFileSync(join(MIGRATIONS_FOLDER, sqlFile), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

async function applyMigration(client: pg.Client, file: string): Promise<void> {
  for (const statement of statements(file)) {
    await client.query(statement)
  }
}

async function countRows(client: pg.Client, table: string): Promise<number> {
  const { rows } = await client.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM "${table}"`
  )
  return rows[0]?.total ?? 0
}

describe('room lifecycle migration (CCC-35)', () => {
  let admin: pg.Client
  let client: pg.Client
  let databaseName: string

  beforeEach(async () => {
    const runContext: PostgresHarnessContext = inject('postgres')
    databaseName = `${runContext.runId}_migration_${randomUUID().replaceAll('-', '').slice(0, 10)}`
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

  it('deletes disposable room data, preserves auth data and lands the new schema', async () => {
    const files = migrationFiles()
    expect(files).toHaveLength(4)

    const migration = files[files.length - 1]!
    for (const file of files.slice(0, -1)) {
      await applyMigration(client, file)
    }

    const suffix = randomUUID().slice(0, 8)
    const userId = `user-${suffix}`
    await client.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
      userId,
      'Migration User',
      `migration-${suffix}@squadzr.test`,
    ])
    await client.query(
      'INSERT INTO "account" (id, account_id, provider_id, user_id) VALUES ($1, $2, $3, $4)',
      [`account-${suffix}`, `provider-${suffix}`, 'credential', userId]
    )
    await client.query(
      'INSERT INTO "session" (id, expires_at, token, user_id) VALUES ($1, now(), $2, $3)',
      [`session-${suffix}`, `token-${suffix}`, userId]
    )

    const { rows: games } = await client.query<{ id: string }>(
      'INSERT INTO "games" (name, slug, cover_url) VALUES ($1, $2, $3) RETURNING id',
      [`Game ${suffix}`, `game-${suffix}`, 'https://cdn.squadzr.test/game.webp']
    )
    const gameId = games[0]?.id
    if (!gameId) throw new Error('Failed to seed a game')
    const { rows: rooms } = await client.query<{ id: string }>(
      `INSERT INTO "rooms" (code, name, host_id, game_id, status, completed_at, ready_notified_at)
       VALUES ($1, $2, $3, $4, 'finished', now(), now()) RETURNING id`,
      [`M${suffix.slice(0, 5).toUpperCase()}`, 'Disposable room', userId, gameId]
    )
    const roomId = rooms[0]?.id
    if (!roomId) throw new Error('Failed to seed a room')
    await client.query('INSERT INTO "room_members" (room_id, user_id) VALUES ($1, $2)', [
      roomId,
      userId,
    ])
    await client.query(
      `INSERT INTO "user_notifications" (user_id, type, title, message)
       VALUES ($1, 'room_ready', 'Room ready', 'Your squad is full.'),
              ($1, 'system_announcement', 'Heads up', 'Kept for history.')`,
      [userId]
    )

    const before = {
      users: await countRows(client, 'user'),
      accounts: await countRows(client, 'account'),
      sessions: await countRows(client, 'session'),
      rooms: await countRows(client, 'rooms'),
      members: await countRows(client, 'room_members'),
      notifications: await countRows(client, 'user_notifications'),
    }
    expect(before).toEqual({
      users: 1,
      accounts: 1,
      sessions: 1,
      rooms: 1,
      members: 1,
      notifications: 2,
    })

    await applyMigration(client, migration!)

    expect({
      users: await countRows(client, 'user'),
      accounts: await countRows(client, 'account'),
      sessions: await countRows(client, 'session'),
    }).toEqual({ users: 1, accounts: 1, sessions: 1 })
    expect({
      rooms: await countRows(client, 'rooms'),
      members: await countRows(client, 'room_members'),
      notifications: await countRows(client, 'user_notifications'),
    }).toEqual({ rooms: 0, members: 0, notifications: 1 })

    const { rows: notifications } = await client.query<{ type: string }>(
      'SELECT type FROM "user_notifications"'
    )
    expect(notifications).toEqual([{ type: 'system_announcement' }])

    const { rows: columns } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'rooms'`
    )
    const columnNames = columns.map((column) => column.column_name)
    expect(columnNames).toEqual(expect.arrayContaining(['ready_at', 'last_activity_at']))
    expect(columnNames).not.toEqual(
      expect.arrayContaining(['completed_at', 'ready_notified_at', 'status'])
    )

    const { rows: enums } = await client.query(
      `SELECT 1 FROM pg_type WHERE typname = 'room_status'`
    )
    expect(enums).toEqual([])

    // The unique key rejects a second logical notification for the same room.
    await client.query(
      `INSERT INTO "user_notifications" (user_id, room_id, type, title, message)
       VALUES ($1, $2, 'room_ready', 'Room ready', 'Once')`,
      [userId, roomId]
    )
    await expect(
      client.query(
        `INSERT INTO "user_notifications" (user_id, room_id, type, title, message)
         VALUES ($1, $2, 'room_ready', 'Room ready', 'Again')`,
        [userId, roomId]
      )
    ).rejects.toMatchObject({ code: '23505' })
  })
})
