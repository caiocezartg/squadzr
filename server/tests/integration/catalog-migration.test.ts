import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import { databaseUrl, type PostgresHarnessContext } from '@test/harness/postgres'

// CCC-88: the catalog migration must upgrade a database that already holds the
// pre-import games and the Squads pointing at them. Legacy catalog rows become
// delisted with no IGDB identity, their thumbnail is copied from the cover and
// every Squad keeps its game reference.

const { Client } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))
// Pinned by tag: later migrations must not change which file this suite applies.
const CATALOG_MIGRATION = '0004_nosy_lifeguard.sql'

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

interface LegacyGameRow {
  igdb_id: number | null
  genres: { slug: string; name: string }[]
  cover_url: string
  thumbnail_url: string
  popularity: number
  listed: boolean
  featured_rank: number | null
}

describe('catalog migration (CCC-88)', () => {
  let admin: pg.Client
  let client: pg.Client
  let databaseName: string

  beforeEach(async () => {
    const runContext: PostgresHarnessContext = inject('postgres')
    databaseName = `${runContext.runId}_catalog_${randomUUID().replaceAll('-', '').slice(0, 10)}`
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

  it('delists seed-era games and keeps the Squads that reference them', async () => {
    const files = migrationFiles()
    const migrationIndex = files.indexOf(CATALOG_MIGRATION)
    expect(migrationIndex).toBeGreaterThanOrEqual(0)

    for (const file of files.slice(0, migrationIndex)) {
      await applyMigration(client, file)
    }

    const suffix = randomUUID().slice(0, 8)
    const userId = `user-${suffix}`
    const gameSlug = `game-${suffix}`
    const coverUrl = `https://cdn.squadzr.test/${gameSlug}-cover.webp`

    await client.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
      userId,
      'Catalog User',
      `catalog-${suffix}@squadzr.test`,
    ])
    // The seed-era row: only the columns the old catalog understood.
    const { rows: games } = await client.query<{ id: string }>(
      'INSERT INTO "games" (name, slug, cover_url) VALUES ($1, $2, $3) RETURNING id',
      [`Legacy ${suffix}`, gameSlug, coverUrl]
    )
    const legacyGameId = games[0]?.id
    if (!legacyGameId) throw new Error('Failed to seed a game')

    const { rows: rooms } = await client.query<{ id: string }>(
      'INSERT INTO "rooms" (code, name, host_id, game_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [`C${suffix.slice(0, 5).toUpperCase()}`, 'Legacy squad', userId, legacyGameId]
    )
    const roomId = rooms[0]?.id
    if (!roomId) throw new Error('Failed to seed a squad')
    await client.query('INSERT INTO "room_members" (room_id, user_id) VALUES ($1, $2)', [
      roomId,
      userId,
    ])

    await applyMigration(client, files[migrationIndex]!)

    const { rows } = await client.query<LegacyGameRow>(
      `SELECT igdb_id, genres, cover_url, thumbnail_url, popularity, listed, featured_rank
       FROM "games" WHERE id = $1`,
      [legacyGameId]
    )
    expect(rows).toEqual([
      {
        igdb_id: null,
        genres: [],
        cover_url: coverUrl,
        thumbnail_url: coverUrl,
        popularity: 0,
        listed: false,
        featured_rank: null,
      },
    ])

    const { rows: squads } = await client.query<{ id: string; game_id: string }>(
      'SELECT id, game_id FROM "rooms" WHERE id = $1',
      [roomId]
    )
    expect(squads).toEqual([{ id: roomId, game_id: legacyGameId }])
    const { rows: members } = await client.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM "room_members" WHERE room_id = $1',
      [roomId]
    )
    expect(members[0]?.total).toBe(1)

    // New catalog rows default to listed, unranked, with no knowledge yet.
    const { rows: imported } = await client.query<LegacyGameRow>(
      `INSERT INTO "games" (name, slug, igdb_id, genres, cover_url, thumbnail_url)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING igdb_id, genres, cover_url, thumbnail_url, popularity, listed, featured_rank`,
      [
        'A'.repeat(150),
        `imported-${suffix}`,
        9001,
        '[{"slug":"shooter","name":"Shooter"}]',
        'https://images.igdb.com/igdb/image/upload/t_cover_big/imported.webp',
        'https://images.igdb.com/igdb/image/upload/t_thumb/imported.webp',
      ]
    )
    expect(imported).toEqual([
      {
        igdb_id: 9001,
        genres: [{ slug: 'shooter', name: 'Shooter' }],
        cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/imported.webp',
        thumbnail_url: 'https://images.igdb.com/igdb/image/upload/t_thumb/imported.webp',
        popularity: 0,
        listed: true,
        featured_rank: null,
      },
    ])

    const { rows: nameColumn } = await client.query<{ character_maximum_length: number }>(
      `SELECT character_maximum_length FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'name'`
    )
    expect(nameColumn[0]?.character_maximum_length).toBe(255)

    // The IGDB id is unique, while legacy rows can all share a null one.
    await expect(
      client.query(
        `INSERT INTO "games" (name, slug, igdb_id, cover_url, thumbnail_url)
         VALUES ('Duplicate', $1, 9001, 'https://cdn.squadzr.test/dup.webp', 'https://cdn.squadzr.test/dup.webp')`,
        [`duplicate-${suffix}`]
      )
    ).rejects.toMatchObject({ code: '23505' })
    await expect(
      client.query(
        `INSERT INTO "games" (name, slug, cover_url) VALUES ('No thumbnail', $1, 'https://cdn.squadzr.test/no-thumb.webp')`,
        [`no-thumbnail-${suffix}`]
      )
    ).rejects.toMatchObject({ code: '23502' })
  })
})
