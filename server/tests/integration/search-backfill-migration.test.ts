import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import pg from 'pg'
import { gamesResponseSchema } from '@squadzr/schemas'
import { buildApp } from '@/app'
import { databaseUrl, type PostgresHarnessContext } from '@test/harness/postgres'
import { createTestEnv, KNOWN_INVITES } from '@test/harness/test-server'

// #100: migration 0007 backfills `games.search_text` from the name, so a game that
// already exists is found by Game Search (without accents or punctuation) before
// any Catalog Import has rewritten the row.

const { Client } = pg
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))
// Pinned by tag: later migrations must not change which file this suite applies last.
const SEARCH_MIGRATION = '0007_abandoned_hannibal_king.sql'

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

describe('search text backfill (#100)', () => {
  let admin: pg.Client
  let client: pg.Client
  let app: FastifyInstance | undefined
  let databaseName: string
  let url: string

  beforeEach(async () => {
    const runContext: PostgresHarnessContext = inject('postgres')
    databaseName = `${runContext.runId}_backfill_${randomUUID().replaceAll('-', '').slice(0, 10)}`
    admin = new Client({ connectionString: runContext.adminUrl })
    await admin.connect()
    await admin.query(`CREATE DATABASE "${databaseName}"`)
    url = databaseUrl(runContext.adminUrl, databaseName)
    client = new Client({ connectionString: url })
    await client.connect()
  })

  afterEach(async () => {
    await app?.close()
    app = undefined
    await client.end()
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
    await admin.end()
  })

  async function searchNames(search: string): Promise<string[]> {
    if (!app) throw new Error('The app is not built yet')
    const response = await app.inject({
      method: 'GET',
      url: `/api/games?search=${encodeURIComponent(search)}`,
    })
    expect(response.statusCode, response.body).toBe(200)
    return gamesResponseSchema.parse(response.json()).games.map((game) => game.name)
  }

  it('finds the games stored before the migration by a term without accents or punctuation', async () => {
    const files = migrationFiles()
    const migrationIndex = files.indexOf(SEARCH_MIGRATION)
    expect(migrationIndex).toBeGreaterThanOrEqual(0)

    for (const file of files.slice(0, migrationIndex)) {
      await applyMigration(client, file)
    }

    // Rows as the import before #100 stored them: no aliases, no search text.
    const cover = 'https://cdn.squadzr.test/cover.webp'
    for (const [index, name] of ['Pokémon Go', 'Counter-Strike 2', 'Valorant'].entries()) {
      await client.query(
        `INSERT INTO "games" (name, slug, igdb_id, cover_url, thumbnail_url)
         VALUES ($1, $2, $3, $4, $4)`,
        [name, `backfill-${index}`, 7000 + index, cover]
      )
    }

    await applyMigration(client, files[migrationIndex]!)

    // No Catalog Import runs: the backfilled search text alone answers.
    app = await buildApp({
      env: createTestEnv({ DATABASE_URL: url }),
      discordPreviews: KNOWN_INVITES,
    })
    await app.ready()

    expect(await searchNames('pokemon')).toEqual(['Pokémon Go'])
    expect(await searchNames('POKÉMON')).toEqual(['Pokémon Go'])
    expect(await searchNames('counter strike')).toEqual(['Counter-Strike 2'])
    expect(await searchNames('valorat')).toEqual(['Valorant'])

    const { rows } = await client.query<{ search_text: string; aliases: string[] }>(
      `SELECT search_text, aliases FROM "games" WHERE name = 'Pokémon Go'`
    )
    expect(rows).toEqual([{ search_text: 'pokemon go', aliases: [] }])
  })

  it('leaves search_text without a default and indexes it with gin_trgm_ops', async () => {
    const files = migrationFiles()
    const migrationIndex = files.indexOf(SEARCH_MIGRATION)
    expect(migrationIndex).toBeGreaterThanOrEqual(0)
    for (const file of files.slice(0, migrationIndex + 1)) {
      await applyMigration(client, file)
    }

    // The default only fed the backfill; a new row must say its search text.
    const column = await client.query<{ column_default: string | null; is_nullable: string }>(
      `SELECT column_default, is_nullable FROM information_schema.columns
       WHERE table_name = 'games' AND column_name = 'search_text'`
    )
    expect(column.rows).toEqual([{ column_default: null, is_nullable: 'NO' }])

    const index = await client.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'games' AND indexname = 'games_search_text_trgm_idx'`
    )
    expect(index.rows).toHaveLength(1)
    expect(index.rows[0]?.indexdef).toContain('USING gin')
    expect(index.rows[0]?.indexdef).toContain('gin_trgm_ops')
  })
})
