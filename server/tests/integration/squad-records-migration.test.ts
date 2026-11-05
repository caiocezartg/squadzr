import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import { databaseUrl, type PostgresHarnessContext } from '@test/harness/postgres'

// #114 data safety: migration 0009 creates the Squad Record tables and backfills the Ready
// Squads that still exist. It runs on a database with none and on one that has Ready and
// Open Squads, and the backfill is a no-op when it runs again.

const { Client } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))
// Pinned by tag: later migrations must not change which file this suite replays.
const RECORDS_MIGRATION = '0009_broken_chronomancer.sql'

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

describe('squad records migration (#114)', () => {
  let admin: pg.Client
  let client: pg.Client
  let databaseName: string

  beforeEach(async () => {
    const runContext: PostgresHarnessContext = inject('postgres')
    databaseName = `${runContext.runId}_records_${randomUUID().replaceAll('-', '').slice(0, 10)}`
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

  async function applyUntilRecords(): Promise<void> {
    const files = migrationFiles()
    const index = files.indexOf(RECORDS_MIGRATION)
    expect(index).toBeGreaterThanOrEqual(0)
    for (const file of files.slice(0, index)) {
      for (const statement of statementsOf(file)) await client.query(statement)
    }
  }

  async function applyRecords(): Promise<void> {
    for (const statement of statementsOf(RECORDS_MIGRATION)) await client.query(statement)
  }

  async function total(table: string): Promise<number> {
    const { rows } = await client.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM "${table}"`
    )
    return rows[0]?.total ?? 0
  }

  async function insertUser(id: string): Promise<void> {
    await client.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
      id,
      id,
      `${id}@squadzr.test`,
    ])
  }

  async function insertGame(): Promise<string> {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO "games" (name, slug, search_text, cover_url, thumbnail_url)
       VALUES ('Game', $1, 'game', 'https://cdn.squadzr.test/c.webp', 'https://cdn.squadzr.test/t.webp')
       RETURNING id`,
      [`game-${randomUUID().slice(0, 8)}`]
    )
    return rows[0]!.id
  }

  async function insertSquad(
    gameId: string,
    hostId: string,
    members: string[],
    readyAt: Date | null,
    platform: string | null = null
  ): Promise<string> {
    const createdAt = new Date('2026-09-01T00:00:00Z')
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO "rooms" (code, name, host_id, game_id, max_players, discord_link, ready_at,
         last_activity_at, platform, created_at, updated_at)
       VALUES ($1, 'Backfilled', $2, $3, $4, 'https://discord.gg/squadzr', $5, $6, $7, $6, $6)
       RETURNING id`,
      [
        randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase(),
        hostId,
        gameId,
        members.length,
        readyAt,
        readyAt ?? createdAt,
        platform,
      ]
    )
    const roomId = rows[0]!.id
    for (const [index, userId] of members.entries()) {
      await client.query(
        'INSERT INTO "room_members" (room_id, user_id, joined_at) VALUES ($1, $2, $3)',
        [roomId, userId, new Date(createdAt.getTime() + index * 1000)]
      )
    }
    return roomId
  }

  it('creates the tables on a database with no Squads and backfills nothing', async () => {
    await applyUntilRecords()

    await applyRecords()

    expect(await total('squad_records')).toBe(0)
    expect(await total('squad_record_members')).toBe(0)
    const { rows } = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'squad_record_members'`
    )
    expect(rows.map((row) => row.indexname)).toContain('squad_record_members_user_idx')
  })

  it('records the existing Ready Squads with their members and skips the Open ones', async () => {
    await applyUntilRecords()
    const [host, second] = [`host-${randomUUID().slice(0, 6)}`, `mate-${randomUUID().slice(0, 6)}`]
    await insertUser(host)
    await insertUser(second)
    const gameId = await insertGame()
    const readyAt = new Date('2026-09-02T10:00:00Z')
    const readyRoom = await insertSquad(gameId, host, [host, second], readyAt, 'pc')
    await insertSquad(gameId, host, [host], null)

    await applyRecords()

    expect(await total('squad_records')).toBe(1)
    expect(await total('squad_record_members')).toBe(2)
    const { rows } = await client.query(`SELECT * FROM "squad_records" WHERE room_id = $1`, [
      readyRoom,
    ])
    expect(rows[0]).toMatchObject({
      game_id: gameId,
      name: 'Backfilled',
      platform: 'pc',
      host_id: host,
      max_players: 2,
      ready_at: readyAt,
    })
    const { rows: members } = await client.query<{ user_id: string }>(
      `SELECT user_id FROM "squad_record_members" ORDER BY joined_at`
    )
    expect(members.map((row) => row.user_id)).toEqual([host, second])
  })

  it('writes nothing new when its backfill runs a second time', async () => {
    await applyUntilRecords()
    const host = `host-${randomUUID().slice(0, 6)}`
    await insertUser(host)
    await insertSquad(await insertGame(), host, [host], new Date('2026-09-02T10:00:00Z'))
    await applyRecords()

    const backfill = statementsOf(RECORDS_MIGRATION).filter((statement) =>
      statement.startsWith('INSERT INTO')
    )
    expect(backfill).toHaveLength(2)
    for (const statement of backfill) await client.query(statement)

    expect(await total('squad_records')).toBe(1)
    expect(await total('squad_record_members')).toBe(1)
  })
})
