import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Platform } from '@squadzr/schemas'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, sql } from 'drizzle-orm'
import * as schema from '@infrastructure/database/schema'
import { games } from '@infrastructure/database/schema'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import { FakeClock } from '@test/harness/clock'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-89: the Catalog Import identifies a game by its IGDB id. upsertByIgdbId
// resolves its conflict inside PostgreSQL on that id, refreshes the catalog
// fields (slug included) and leaves every other row alone.

const LOL = {
  igdbId: 115,
  name: 'League of Legends',
  slug: 'lol',
  genres: [{ slug: 'moba', name: 'MOBA' }],
  platforms: ['pc'] as Platform[],
  aliases: [] as string[],
  coverUrl: 'https://cdn.squadzr.test/lol.webp',
  thumbnailUrl: 'https://cdn.squadzr.test/lol-thumb.webp',
  popularity: 950,
  minPlayers: 2,
  maxPlayers: 5,
  featuredRank: 2,
}

let server: TestServer
let repository: DrizzleGameRepository

beforeEach(async () => {
  server = await buildTestServer()
  repository = new DrizzleGameRepository(server.app.db, server.app.clock)
})

afterEach(async () => {
  await server.close()
})

async function countRows(): Promise<number> {
  return (await server.app.db.select().from(games)).length
}

describe('DrizzleGameRepository.upsertByIgdbId', () => {
  it('inserts a game whose IGDB id is new, next to the games already stored', async () => {
    await repository.upsertByIgdbId(LOL)
    const cs2 = await repository.upsertByIgdbId({
      ...LOL,
      igdbId: 2052,
      name: 'Counter-Strike 2',
      slug: 'cs2',
    })

    expect(cs2).toMatchObject({ igdbId: 2052, name: 'Counter-Strike 2', slug: 'cs2' })
    expect(await countRows()).toBe(2)
  })

  it('updates the row on an IGDB-id conflict, keeping its id and creation time', async () => {
    const created = await repository.upsertByIgdbId(LOL)
    const before = new Date()

    const updated = await repository.upsertByIgdbId({
      ...LOL,
      name: 'League of Legends: Wild Rift',
      slug: 'league-of-legends-wild-rift',
      coverUrl: 'https://cdn.squadzr.test/wild-rift.webp',
      popularity: 980,
      minPlayers: 1,
      maxPlayers: 6,
      featuredRank: null,
    })

    expect(updated).toMatchObject({
      id: created.id,
      igdbId: 115,
      slug: 'league-of-legends-wild-rift',
      name: 'League of Legends: Wild Rift',
      coverUrl: 'https://cdn.squadzr.test/wild-rift.webp',
      popularity: 980,
      minPlayers: 1,
      maxPlayers: 6,
      featuredRank: null,
    })
    expect(updated.createdAt).toEqual(created.createdAt)
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(await countRows()).toBe(1)
  })

  it('stamps updatedAt from the injected clock on an IGDB-id conflict', async () => {
    const instant = new Date('2026-01-01T00:00:00.000Z')
    await repository.upsertByIgdbId(LOL)
    const pinned = new DrizzleGameRepository(server.app.db, new FakeClock(instant))

    const updated = await pinned.upsertByIgdbId({ ...LOL, name: 'League of Legends: Wild Rift' })

    expect(updated.updatedAt).toEqual(instant)
  })

  it('stores the platforms and replaces them on an IGDB-id conflict', async () => {
    const created = await repository.upsertByIgdbId({ ...LOL, platforms: ['pc', 'ps5'] })
    expect(created.platforms).toEqual(['pc', 'ps5'])

    const updated = await repository.upsertByIgdbId({ ...LOL, platforms: [] })

    expect(updated.id).toBe(created.id)
    expect(updated.platforms).toEqual([])
    expect((await repository.findById(created.id))?.platforms).toEqual([])
  })

  it('stores the aliases and the search text normalized, without repeats or the game name', async () => {
    const created = await repository.upsertByIgdbId({
      ...LOL,
      name: 'Pokémon UNITE',
      aliases: ['PKMN Unite', 'pkmn  unite', 'Pokemon Unite', '  ', '!!', 'Unite'],
    })

    const [row] = await server.app.db.select().from(games).where(eq(games.id, created.id))
    expect(row?.aliases).toEqual(['pkmn unite', 'unite'])
    expect(row?.searchText).toBe('pokemon unite | pkmn unite | unite')
  })

  it('stores the search text alone when the game has no aliases', async () => {
    const created = await repository.upsertByIgdbId({ ...LOL, name: 'Counter-Strike 2' })

    const [row] = await server.app.db.select().from(games).where(eq(games.id, created.id))
    expect(row?.aliases).toEqual([])
    expect(row?.searchText).toBe('counter strike 2')
  })

  it('rewrites the aliases and the search text on an IGDB-id conflict', async () => {
    const created = await repository.upsertByIgdbId({ ...LOL, aliases: ['lol'] })

    await repository.upsertByIgdbId({
      ...LOL,
      name: 'League of Legends: Wild Rift',
      aliases: ['wr'],
    })

    const [row] = await server.app.db.select().from(games).where(eq(games.id, created.id))
    expect(row?.aliases).toEqual(['wr'])
    expect(row?.searchText).toBe('league of legends wild rift | wr')
  })

  it('keeps exactly one row when the same catalog entry is upserted again', async () => {
    const first = await repository.upsertByIgdbId(LOL)
    const second = await repository.upsertByIgdbId(LOL)

    expect(second.id).toBe(first.id)
    expect(await countRows()).toBe(1)
  })

  it('allows the same slug on different IGDB ids: identity moved off the slug', async () => {
    const first = await repository.upsertByIgdbId(LOL)
    const second = await repository.upsertByIgdbId({ ...LOL, igdbId: 1150 })

    expect(second.id).not.toBe(first.id)
    expect(second.slug).toBe(first.slug)
    expect(await countRows()).toBe(2)
  })
})

describe('DrizzleGameRepository listing actions', () => {
  it('delists and relists only the imported rows addressed by IGDB id', async () => {
    const imported = await repository.upsertByIgdbId(LOL)
    await server.app.db.insert(games).values({
      name: 'Legacy game',
      slug: 'legacy-game',
      searchText: 'legacy game',
      coverUrl: 'https://cdn.squadzr.test/legacy.webp',
      thumbnailUrl: 'https://cdn.squadzr.test/legacy.webp',
      listed: true,
    })

    expect(await repository.delistByIgdbIds([imported.igdbId!])).toBe(1)
    const delisted = await repository.findById(imported.id)
    expect(delisted?.listed).toBe(false)

    // A legacy row has no IGDB id, so no IGDB-id list can reach it.
    expect(await repository.delistByIgdbIds([999_999])).toBe(0)

    expect(await repository.relistByIgdbIds([imported.igdbId!])).toBe(1)
    const relisted = await repository.findById(imported.id)
    expect(relisted?.listed).toBe(true)

    const legacy = (await repository.findAll()).find((game) => game.igdbId === null)
    expect(legacy?.listed).toBe(true)
  })
})

// #100: the similarity search reads its threshold from a setting; it must stay inside the search's
// transaction, because the connection goes back to the pool for the next request.
describe('DrizzleGameRepository.search', () => {
  let pool: pg.Pool

  beforeEach(() => {
    // One connection, so the search and the reads below share the same session.
    pool = new pg.Pool({ connectionString: server.databaseUrl, max: 1 })
  })

  afterEach(async () => {
    // Runs before the outer teardown drops the database, which fails while a connection is open.
    await pool.end()
  })

  it('leaves the pg_trgm threshold of the pooled connection untouched', async () => {
    const db = drizzle(pool, { schema })
    const single = new DrizzleGameRepository(db, server.app.clock)
    await single.upsertByIgdbId({ ...LOL, name: 'Valorant', igdbId: 126_459 })
    // A value the search never uses (0.5 or 0.7), so a leak would change it.
    await db.execute(sql`SELECT set_config('pg_trgm.word_similarity_threshold', '0.9', false)`)
    const readThreshold = async () =>
      (
        await db.execute<{ value: string | null }>(
          sql`SELECT current_setting('pg_trgm.word_similarity_threshold', true) AS value`
        )
      ).rows[0]?.value

    expect(await readThreshold()).toBe('0.9')
    expect((await single.search({ search: 'valorat', limit: 5 })).map((g) => g.name)).toEqual([
      'Valorant',
    ])

    expect(await readThreshold()).toBe('0.9')
  })
})
