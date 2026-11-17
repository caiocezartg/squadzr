import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import { databaseUrl, type PostgresHarnessContext } from '@test/harness/postgres'

// #190 data safety: migration 0016 adds the Squad's Voice Call as two nullable columns and a check that
// keeps them together. It must apply on a database that already has Squads, which then have no call.

const { Client } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))
// Pinned by tag: later migrations must not change which file this suite replays.
const CALL_MIGRATION = '0016_squad_voice_call.sql'

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

describe('Squad Voice Call migration (#190)', () => {
  let admin: pg.Client
  let client: pg.Client
  let databaseName: string
  let userId: string
  let gameId: string

  beforeEach(async () => {
    const runContext: PostgresHarnessContext = inject('postgres')
    databaseName = `${runContext.runId}_call_${randomUUID().replaceAll('-', '').slice(0, 10)}`
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

  async function applyBeforeCallMigration(): Promise<void> {
    const files = migrationFiles()
    const index = files.indexOf(CALL_MIGRATION)
    expect(index).toBeGreaterThanOrEqual(0)
    for (const file of files.slice(0, index)) {
      for (const statement of statementsOf(file)) await client.query(statement)
    }
  }

  async function applyCallMigration(): Promise<void> {
    for (const statement of statementsOf(CALL_MIGRATION)) await client.query(statement)
  }

  async function seedUserAndGame(): Promise<void> {
    userId = `user-${randomUUID().slice(0, 8)}`
    await client.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
      userId,
      'Host',
      `${userId}@squadzr.test`,
    ])
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO "games" (name, slug, cover_url, thumbnail_url, search_text) VALUES ($1, $2, $3, $3, $4) RETURNING id',
      ['Game', `game-${randomUUID().slice(0, 8)}`, 'https://cdn.squadzr.test/game.webp', 'game']
    )
    gameId = rows[0]?.id ?? ''
    expect(gameId).not.toBe('')
  }

  async function insertSquad(code: string, call?: [string | null, string | null]): Promise<void> {
    if (call === undefined) {
      await client.query(
        `INSERT INTO "rooms" (code, name, host_id, game_id, discord_link) VALUES ($1, 'Squad', $2, $3, 'https://discord.gg/old')`,
        [code, userId, gameId]
      )
      return
    }
    await client.query(
      `INSERT INTO "rooms" (code, name, host_id, game_id, discord_link, discord_call_id, discord_call_name)
       VALUES ($1, 'Squad', $2, $3, 'https://discord.gg/new', $4, $5)`,
      [code, userId, gameId, ...call]
    )
  }

  it('applies on a database that already has Squads, which keep their data and have no call', async () => {
    await applyBeforeCallMigration()
    await seedUserAndGame()
    await insertSquad('OLD001')
    await insertSquad('OLD002')

    await applyCallMigration()

    const { rows } = await client.query<Record<string, unknown>>(
      'SELECT code, discord_link, discord_call_id, discord_call_name FROM "rooms" ORDER BY code'
    )
    expect(rows).toEqual([
      {
        code: 'OLD001',
        discord_link: 'https://discord.gg/old',
        discord_call_id: null,
        discord_call_name: null,
      },
      {
        code: 'OLD002',
        discord_link: 'https://discord.gg/old',
        discord_call_id: null,
        discord_call_name: null,
      },
    ])
  })

  it('stores a call with both columns or neither, and refuses one without the other', async () => {
    await applyBeforeCallMigration()
    await seedUserAndGame()
    await applyCallMigration()

    await insertSquad('BOTH01', ['1234567890123456', 'Squad call'])
    await insertSquad('NONE01', [null, null])

    await expect(insertSquad('ONLYID', ['1234567890123456', null])).rejects.toThrow(
      /rooms_discord_call_both_or_neither/
    )
    await expect(insertSquad('ONLYNM', [null, 'Squad call'])).rejects.toThrow(
      /rooms_discord_call_both_or_neither/
    )
    await expect(
      client.query(`UPDATE "rooms" SET discord_call_name = NULL WHERE code = 'BOTH01'`)
    ).rejects.toThrow(/rooms_discord_call_both_or_neither/)
  })
})
