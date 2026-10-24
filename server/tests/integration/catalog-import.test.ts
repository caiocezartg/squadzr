import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { IGameRepository } from '@domain/repositories/game.repository'
import { games } from '@infrastructure/database/schema'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import {
  CatalogImportSafetyError,
  CatalogImportUseCase,
  type CatalogImportSafety,
  type CuratedGame,
} from '@application/use-cases/game/catalog-import.use-case'
import { GAME_CATALOG_IMPORT } from '@config/constants'
import { createCatalogImportUseCase } from '@interface/factories/catalog-import.factory'
import { CURATED_GAMES } from '@interface/catalog/curated-games'
import { createCandidate, FakeGameCatalogSource } from '@test/harness/game-catalog-source'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-89: one Catalog Import run brings the Game Catalog in line with the
// candidates of a Game Catalog Source, in one transaction, with the safety
// stops and the curated squad sizes/featured ranks applied exactly in order.

const SAFETY: CatalogImportSafety = {
  minimumRetainedFraction: GAME_CATALOG_IMPORT.MINIMUM_RETAINED_FRACTION,
  minimumCandidates: GAME_CATALOG_IMPORT.MINIMUM_CANDIDATES,
}
/** Lets the rule-focused tests run with small fixtures; the safety suite pins the real limits. */
const SMALL_CATALOG_SAFETY: CatalogImportSafety = {
  minimumRetainedFraction: 0.1,
  minimumCandidates: 1,
}

let server: TestServer
let source: FakeGameCatalogSource

beforeEach(async () => {
  server = await buildTestServer()
  source = new FakeGameCatalogSource()
})

afterEach(async () => {
  await server.close()
})

function buildUseCase(
  options: {
    curated?: readonly CuratedGame[]
    safety?: CatalogImportSafety
  } = {}
): CatalogImportUseCase {
  return new CatalogImportUseCase(
    source,
    new DrizzleGameRepository(server.app.db, server.app.clock),
    options.curated ?? [],
    options.safety ?? SMALL_CATALOG_SAFETY
  )
}

async function catalog() {
  return server.app.db.select().from(games)
}

async function seedListedGames(count: number): Promise<void> {
  const values = Array.from({ length: count }, (_, index) => {
    const igdbId = 5000 + index
    return {
      igdbId,
      name: `Seeded ${igdbId}`,
      slug: `seeded-${igdbId}`,
      coverUrl: `https://cdn.squadzr.test/seeded-${igdbId}.webp`,
      thumbnailUrl: `https://cdn.squadzr.test/seeded-${igdbId}.webp`,
      listed: true,
    }
  })
  await server.app.db.insert(games).values(values)
}

function candidates(count: number, start = 2000) {
  return Array.from({ length: count }, (_, index) => {
    const igdbId = start + index
    return createCandidate({
      igdbId,
      name: `Game ${igdbId}`,
      slug: `game-${igdbId}`,
    })
  })
}

/** Delegates every call to `inner`, except the relist, which fails after the delist. */
function failAtRelist(inner: IGameRepository): IGameRepository {
  return {
    findById: (id) => inner.findById(id),
    findAll: () => inner.findAll(),
    search: (input) => inner.search(input),
    upsertByIgdbId: (input) => inner.upsertByIgdbId(input),
    delistByIgdbIds: (igdbIds) => inner.delistByIgdbIds(igdbIds),
    relistByIgdbIds: () => Promise.reject(new Error('relist failed after delist')),
    acquireCatalogImportLock: () => inner.acquireCatalogImportLock(),
    runInTransaction: (work) => inner.runInTransaction((tx) => work(failAtRelist(tx))),
  }
}

interface LockGate {
  readonly onLocked: () => void
  readonly release: Promise<void>
}

/** Holds the transaction open right after it acquired the Catalog Import lock. */
function createGatedRepository(inner: IGameRepository, gate: LockGate): IGameRepository {
  return {
    findById: (id) => inner.findById(id),
    findAll: () => inner.findAll(),
    search: (input) => inner.search(input),
    upsertByIgdbId: (input) => inner.upsertByIgdbId(input),
    delistByIgdbIds: (igdbIds) => inner.delistByIgdbIds(igdbIds),
    relistByIgdbIds: (igdbIds) => inner.relistByIgdbIds(igdbIds),
    acquireCatalogImportLock: async () => {
      await inner.acquireCatalogImportLock()
      gate.onLocked()
      await gate.release
    },
    runInTransaction: (work) =>
      inner.runInTransaction((tx) => work(createGatedRepository(tx, gate))),
  }
}

/** Waits until a connection of this test's database blocks on the import lock. */
async function waitForAdvisoryLockWaiter(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { rows } = await server.app.db.execute<{ waiters: number }>(sql`
      select count(*)::int as waiters
      from pg_locks l
      join pg_stat_activity a on a.pid = l.pid
      where l.locktype = 'advisory'
        and not l.granted
        and a.datname = current_database()
    `)
    if ((rows[0]?.waiters ?? 0) > 0) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error('no Catalog Import run waited on the advisory lock')
}

describe('CatalogImportUseCase', () => {
  it('creates every candidate with the curated squad sizes and featured ranks', async () => {
    const curated: CuratedGame[] = [
      { igdbId: 1001, name: 'League of Legends', minPlayers: 4, maxPlayers: 50, featuredRank: 1 },
      { igdbId: 1002, name: 'Counter-Strike 2', minPlayers: 2, maxPlayers: 3, featuredRank: null },
    ]
    source.withCandidates([
      createCandidate({
        igdbId: 1001,
        name: 'League of Legends',
        slug: 'lol',
        multiplayer: { onlineCoopMax: null, onlineMax: 5 },
      }),
      createCandidate({ igdbId: 1002, name: 'Counter-Strike 2', slug: 'cs2' }),
      createCandidate({
        igdbId: 1003,
        name: 'Deep Rock Galactic',
        slug: 'deep-rock-galactic',
        genres: [{ slug: 'shooter', name: 'Shooter' }],
        coverUrl: 'https://images.igdb.com/cover/drg.webp',
        thumbnailUrl: 'https://images.igdb.com/thumb/drg.webp',
        multiplayer: { onlineCoopMax: 8, onlineMax: null },
        popularity: 250,
      }),
    ])

    const summary = await buildUseCase({ curated }).execute()

    expect(summary).toMatchObject({
      created: 3,
      updated: 0,
      delisted: 0,
      relisted: 0,
      received: 3,
      dropped: 0,
    })
    expect(summary.durationMs).toBeGreaterThanOrEqual(0)

    const rows = await catalog()
    expect(rows).toHaveLength(3)
    expect(rows.find((row) => row.igdbId === 1001)).toMatchObject({
      name: 'League of Legends',
      slug: 'lol',
      minPlayers: 4,
      maxPlayers: 40,
      featuredRank: 1,
      listed: true,
    })
    expect(rows.find((row) => row.igdbId === 1002)).toMatchObject({
      minPlayers: 2,
      maxPlayers: 3,
      featuredRank: null,
    })
    expect(rows.find((row) => row.igdbId === 1003)).toMatchObject({
      name: 'Deep Rock Galactic',
      genres: [{ slug: 'shooter', name: 'Shooter' }],
      coverUrl: 'https://images.igdb.com/cover/drg.webp',
      thumbnailUrl: 'https://images.igdb.com/thumb/drg.webp',
      popularity: 250,
      minPlayers: 2,
      maxPlayers: 8,
    })
  })

  it('is idempotent on a re-run: every candidate is updated in place, none is duplicated', async () => {
    source.withCandidates(candidates(2))
    const first = await buildUseCase().execute()
    const firstIds = (await catalog()).map((row) => row.id).sort()

    const second = await buildUseCase().execute()

    expect(first.created).toBe(2)
    expect(second).toMatchObject({
      created: 0,
      updated: 2,
      delisted: 0,
      relisted: 0,
      received: 2,
      dropped: 0,
    })
    expect((await catalog()).map((row) => row.id).sort()).toEqual(firstIds)
  })

  it('updates a returning game, including its slug', async () => {
    source.withCandidates([
      createCandidate({ igdbId: 1001, name: 'League of Legends', slug: 'lol' }),
    ])
    const created = await buildUseCase().execute()
    const [before] = await catalog()

    source.withCandidates([
      createCandidate({
        igdbId: 1001,
        name: 'League of Legends',
        slug: 'league-of-legends',
        genres: [{ slug: 'moba', name: 'MOBA' }],
        coverUrl: 'https://images.igdb.com/cover/lol-2.webp',
        thumbnailUrl: 'https://images.igdb.com/thumb/lol-2.webp',
        popularity: 990,
      }),
    ])
    const updated = await buildUseCase().execute()

    expect(created.created).toBe(1)
    expect(updated).toMatchObject({ created: 0, updated: 1 })
    expect(await catalog()).toHaveLength(1)
    expect((await catalog())[0]).toMatchObject({
      id: before?.id,
      slug: 'league-of-legends',
      coverUrl: 'https://images.igdb.com/cover/lol-2.webp',
      popularity: 990,
    })
  })

  it('delists listed games missing from the candidates and relists them when they return', async () => {
    const [gameA, gameB, gameC] = candidates(3)
    source.withCandidates([gameA!, gameB!, gameC!])
    await buildUseCase().execute()

    source.withCandidates([gameA!, gameC!])
    const delistRun = await buildUseCase().execute()

    expect(delistRun).toMatchObject({ created: 0, updated: 2, delisted: 1, relisted: 0 })
    const delisted = (await catalog()).find((row) => row.igdbId === gameB!.igdbId)
    expect(delisted?.listed).toBe(false)

    source.withCandidates([gameA!, gameB!, gameC!])
    const relistRun = await buildUseCase().execute()

    expect(relistRun).toMatchObject({ created: 0, updated: 3, delisted: 0, relisted: 1 })
    const relisted = (await catalog()).find((row) => row.igdbId === gameB!.igdbId)
    expect(relisted?.listed).toBe(true)
  })

  it('stops before writing below the absolute floor, and the override does not bypass it', async () => {
    source.withCandidates(candidates(4))
    const useCase = buildUseCase({ safety: SAFETY })

    const error = await useCase.execute().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(CatalogImportSafetyError)
    expect(error).toMatchObject({ stop: 'below_floor' })
    expect(await catalog()).toHaveLength(0)

    const overridden = await useCase
      .execute({ overrideFractionCheck: true })
      .catch((caught: unknown) => caught)
    expect(overridden).toBeInstanceOf(CatalogImportSafetyError)
    expect(overridden).toMatchObject({ stop: 'below_floor' })
    expect(await catalog()).toHaveLength(0)
  })

  it('stops before writing below a fraction of the Listed Games; the override bypasses only that check', async () => {
    await seedListedGames(30)
    source.withCandidates(candidates(12))
    const useCase = buildUseCase({ safety: SAFETY })

    const error = await useCase.execute().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(CatalogImportSafetyError)
    expect(error).toMatchObject({ stop: 'below_fraction' })
    expect(await catalog()).toHaveLength(30)
    expect((await catalog()).every((row) => row.name.startsWith('Seeded '))).toBe(true)

    const summary = await useCase.execute({ overrideFractionCheck: true })

    expect(summary).toMatchObject({ created: 12, delisted: 30, received: 12 })
    const rows = await catalog()
    expect(rows).toHaveLength(42)
    expect(rows.filter((row) => row.listed)).toHaveLength(12)
  })

  it('serializes concurrent runs so neither can pass the fraction check on a stale count', async () => {
    let onLocked!: () => void
    let releaseLock!: () => void
    const locked = new Promise<void>((resolve) => {
      onLocked = resolve
    })
    const release = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    const safety: CatalogImportSafety = { minimumRetainedFraction: 0.5, minimumCandidates: 1 }

    source.withCandidates(candidates(12, 2100))
    const first = new CatalogImportUseCase(
      source,
      createGatedRepository(new DrizzleGameRepository(server.app.db, server.app.clock), {
        onLocked,
        release,
      }),
      [],
      safety
    )
    const firstRun = first.execute()
    await locked

    // Four candidates pass against today's empty catalog, but not against the
    // twelve the first run is listing; the lock makes the second run wait.
    const secondSource = new FakeGameCatalogSource().withCandidates(candidates(4, 2200))
    const second = new CatalogImportUseCase(
      secondSource,
      new DrizzleGameRepository(server.app.db, server.app.clock),
      [],
      safety
    )
    const secondResult = second.execute().catch((error: unknown) => error)

    await waitForAdvisoryLockWaiter()
    releaseLock()
    await firstRun

    const error = await secondResult
    expect(error).toBeInstanceOf(CatalogImportSafetyError)
    expect(error).toMatchObject({ stop: 'below_fraction' })
    expect(await catalog()).toHaveLength(12)
  })

  it('applies every squad-size rule in order', async () => {
    const curated: CuratedGame[] = [
      { igdbId: 2001, name: 'Curated', minPlayers: 4, maxPlayers: 50, featuredRank: null },
    ]
    source.withCandidates([
      createCandidate({ igdbId: 2001, multiplayer: { onlineCoopMax: null, onlineMax: 10 } }),
      createCandidate({ igdbId: 2002, multiplayer: { onlineCoopMax: 8, onlineMax: 12 } }),
      createCandidate({ igdbId: 2003, multiplayer: { onlineCoopMax: 12, onlineMax: 3 } }),
      createCandidate({ igdbId: 2004, multiplayer: { onlineCoopMax: null, onlineMax: 1 } }),
      createCandidate({ igdbId: 2005, multiplayer: { onlineCoopMax: null, onlineMax: null } }),
      createCandidate({ igdbId: 2006, multiplayer: { onlineCoopMax: null, onlineMax: 50 } }),
      createCandidate({ igdbId: 2007, multiplayer: { onlineCoopMax: null, onlineMax: 40 } }),
      createCandidate({ igdbId: 2008, multiplayer: { onlineCoopMax: null, onlineMax: 2 } }),
    ])

    await buildUseCase({ curated }).execute()

    const sizes = new Map(
      (await catalog()).map((row) => [row.igdbId, { min: row.minPlayers, max: row.maxPlayers }])
    )
    expect(sizes.get(2001)).toEqual({ min: 4, max: 40 })
    expect(sizes.get(2002)).toEqual({ min: 2, max: 12 })
    expect(sizes.get(2003)).toEqual({ min: 2, max: 12 })
    expect(sizes.get(2004)).toEqual({ min: 2, max: 5 })
    expect(sizes.get(2005)).toEqual({ min: 2, max: 5 })
    expect(sizes.get(2006)).toEqual({ min: 2, max: 5 })
    expect(sizes.get(2007)).toEqual({ min: 2, max: 40 })
    expect(sizes.get(2008)).toEqual({ min: 2, max: 2 })
  })

  it('persists the curated featured ranks and clears a rank when a game leaves the list', async () => {
    source.withCandidates(candidates(2, 3001))
    await buildUseCase({
      curated: [
        { igdbId: 3001, name: 'First', minPlayers: 2, maxPlayers: 5, featuredRank: 1 },
        { igdbId: 3002, name: 'Second', minPlayers: 2, maxPlayers: 5, featuredRank: 2 },
      ],
    }).execute()

    expect(
      (await catalog())
        .map((row) => [row.igdbId, row.featuredRank])
        .sort((a, b) => Number(a[0]) - Number(b[0]))
    ).toEqual([
      [3001, 1],
      [3002, 2],
    ])

    await buildUseCase({
      curated: [{ igdbId: 3001, name: 'First', minPlayers: 2, maxPlayers: 5, featuredRank: 1 }],
    }).execute()

    expect(
      (await catalog())
        .map((row) => [row.igdbId, row.featuredRank])
        .sort((a, b) => Number(a[0]) - Number(b[0]))
    ).toEqual([
      [3001, 1],
      [3002, null],
    ])
  })

  it('never touches legacy rows without an IGDB id', async () => {
    const [legacy] = await server.app.db
      .insert(games)
      .values({
        name: 'Legacy game',
        slug: 'legacy-game',
        coverUrl: 'https://cdn.squadzr.test/legacy.webp',
        thumbnailUrl: 'https://cdn.squadzr.test/legacy-thumb.webp',
        popularity: 7,
        listed: true,
        featuredRank: 9,
        minPlayers: 3,
        maxPlayers: 9,
      })
      .returning()

    source.withCandidates(candidates(2))
    await buildUseCase().execute()

    const after = (await catalog()).find((row) => row.id === legacy?.id)
    expect(after).toEqual(legacy)
    expect((await catalog()).filter((row) => row.igdbId === null)).toHaveLength(1)
  })

  it('rolls back every created row when one candidate fails mid-run', async () => {
    source.withCandidates([
      createCandidate({ igdbId: 4001 }),
      createCandidate({ igdbId: 4002 }),
      createCandidate({ igdbId: 4003, name: 'x'.repeat(256) }),
    ])

    await expect(buildUseCase().execute()).rejects.toThrow()

    expect(await catalog()).toHaveLength(0)
  })

  it('rolls back updates and delists of existing rows when the run fails mid-transaction', async () => {
    await seedListedGames(2)
    const before = new Map((await catalog()).map((row) => [row.id, row]))
    expect(before.size).toBe(2)

    // 5000 would be updated and 5001, absent from the candidates, delisted; the
    // relist fails after both writes, so the transaction must undo them.
    source.withCandidates([
      createCandidate({
        igdbId: 5000,
        name: 'Seeded 5000 updated',
        slug: 'seeded-5000-updated',
        genres: [{ slug: 'shooter', name: 'Shooter' }],
        popularity: 999,
        multiplayer: { onlineCoopMax: null, onlineMax: 12 },
      }),
      createCandidate({ igdbId: 4001 }),
    ])

    const useCase = new CatalogImportUseCase(
      source,
      failAtRelist(new DrizzleGameRepository(server.app.db, server.app.clock)),
      [],
      SMALL_CATALOG_SAFETY
    )

    await expect(useCase.execute()).rejects.toThrow('relist failed after delist')

    const after = await catalog()
    expect(after).toHaveLength(2)
    for (const row of after) {
      // toEqual covers every column, including name, slug, listed, sizes,
      // featuredRank and updatedAt.
      expect(row).toEqual(before.get(row.id))
    }
  })

  it('counts duplicate candidates as received but not as written games', async () => {
    source.withCandidates([
      createCandidate({ igdbId: 6001 }),
      createCandidate({ igdbId: 6001, name: 'Duplicate' }),
      createCandidate({ igdbId: 6002 }),
    ])

    const summary = await buildUseCase().execute()

    expect(summary).toMatchObject({ received: 3, dropped: 1, created: 2 })
    expect(await catalog()).toHaveLength(2)
  })

  it('wires the curated list and the safety limits through the factory', async () => {
    source.withCandidates(
      CURATED_GAMES.map((game) =>
        createCandidate({
          igdbId: game.igdbId,
          name: game.name,
          slug: `curated-${game.igdbId}`,
          multiplayer: { onlineCoopMax: null, onlineMax: 4 },
        })
      )
    )

    const summary = await createCatalogImportUseCase(
      server.app.db,
      server.app.clock,
      source
    ).execute()

    expect(summary).toMatchObject({ created: CURATED_GAMES.length, received: CURATED_GAMES.length })

    const rows = await catalog()
    expect(rows.find((row) => row.name === 'Roblox')).toMatchObject({
      minPlayers: 2,
      maxPlayers: 40,
    })
    expect(rows.filter((row) => row.featuredRank !== null)).toHaveLength(6)
  })
})
