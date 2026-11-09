import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  adminGameDetailResponseSchema,
  adminGamesResponseSchema,
  adminGamesSummarySchema,
  PAGE_SIZE,
} from '@squadzr/schemas'
import { eq } from 'drizzle-orm'
import { catalogImportRuns, games, squadRecords } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import {
  createRoom,
  get,
  insertGameFixture,
  setRoomLifecycle,
  type InsertGameOptions,
} from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #122: the read-only Games view of the admin Catalog. GET /api/admin/catalog/games lists every Game of
// the catalog, listed or not, with its usage; /summary counts them and names what the last succeeded
// import changed; /:id is one Game with its Open Squads. All three are admin-or-owner routes.

const PATH = '/api/admin/catalog/games'

let server: TestServer
let admin: TestUser

beforeEach(async () => {
  server = await buildTestServer()
  admin = await signIn(server, 'Admin', { role: 'admin' })
})

afterEach(async () => {
  await server.close()
})

async function addGame(options: InsertGameOptions = {}) {
  return (await insertGameFixture(server, options)).game
}

async function addCompleted(gameId: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await server.app.db.insert(squadRecords).values({
      roomId: randomUUID(),
      gameId,
      name: 'Squad',
      maxPlayers: 5,
      readyAt: new Date('2026-11-01T12:00:00.000Z'),
    })
  }
}

/** Open Squads on the Game, one host each (a host holds one Squad at a time). */
async function addOpenSquads(gameId: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const host = await signIn(server, `Host ${randomUUID().slice(0, 6)}`)
    await createRoom(server, host, { gameId, maxPlayers: 5 })
  }
}

async function list(query = '') {
  const response = await get(server, `${PATH}${query}`, admin)
  expect(response.statusCode, response.body).toBe(200)
  return adminGamesResponseSchema.parse(response.json())
}

const names = (body: { items: readonly { name: string }[] }) => body.items.map((game) => game.name)

describe('GET /api/admin/catalog/games', () => {
  it('answers an empty first page with the real total when the catalog is empty', async () => {
    expect(await list()).toEqual({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0 })
  })

  it('lists listed and delisted games by popularity with their row fields', async () => {
    await addGame({ name: 'Quiet Game', popularity: 10 })
    const popular = await addGame({
      name: 'Popular Game',
      popularity: 900,
      platforms: ['pc'],
      featuredRank: 2,
      minPlayers: 3,
      maxPlayers: 6,
    })
    await addGame({ name: 'Hidden Game', popularity: 50, listed: false })

    const body = await list()

    expect(names(body)).toEqual(['Popular Game', 'Hidden Game', 'Quiet Game'])
    expect(body.total).toBe(3)
    expect(body.items[0]).toEqual({
      id: popular.id,
      name: 'Popular Game',
      slug: popular.slug,
      coverThumbUrl: popular.coverThumbUrl,
      platforms: ['pc'],
      minPlayers: 3,
      maxPlayers: 6,
      popularity: 900,
      featuredRank: 2,
      listed: true,
      usage: { openSquads: 0, completedSquads: 0 },
    })
    expect(body.items[1]?.listed).toBe(false)
  })

  it('counts each game’s Open Squads and completed Squads, and ignores a Ready or expired Squad', async () => {
    const busy = await addGame({ name: 'Busy', popularity: 1 })
    await addGame({ name: 'Idle', popularity: 2 })
    await addOpenSquads(busy.id, 2)
    await addCompleted(busy.id, 3)
    // A Squad whose activity window ended is no longer open.
    const expiredHost = await signIn(server, 'Expired host')
    const expired = await createRoom(server, expiredHost, { gameId: busy.id, maxPlayers: 5 })
    const longAgo = new Date(Date.now() - 48 * 3_600_000)
    await setRoomLifecycle(server, expired.id, {
      createdAt: longAgo,
      lastActivityAt: longAgo,
      readyAt: null,
    })

    const body = await list()

    const usageOf = (name: string) => body.items.find((game) => game.name === name)?.usage
    expect(usageOf('Busy')).toEqual({ openSquads: 2, completedSquads: 3 })
    expect(usageOf('Idle')).toEqual({ openSquads: 0, completedSquads: 0 })
  })

  describe('filters', () => {
    beforeEach(async () => {
      await addGame({ name: 'Listed Plain', popularity: 5 })
      await addGame({ name: 'Listed Featured', popularity: 4, featuredRank: 1 })
      await addGame({ name: 'Delisted Plain', popularity: 3, listed: false })
      await addGame({ name: 'Delisted Ranked', popularity: 2, listed: false, featuredRank: 3 })
    })

    it('keeps all games by default and for status=all', async () => {
      expect((await list()).total).toBe(4)
      expect((await list('?status=all')).total).toBe(4)
      expect((await list('?status=')).total).toBe(4)
    })

    it('keeps only the listed games', async () => {
      expect(names(await list('?status=listed'))).toEqual(['Listed Plain', 'Listed Featured'])
    })

    it('keeps only the delisted games', async () => {
      expect(names(await list('?status=delisted'))).toEqual(['Delisted Plain', 'Delisted Ranked'])
    })

    it('keeps only the Listed Games with a featured rank', async () => {
      expect(names(await list('?status=featured'))).toEqual(['Listed Featured'])
    })

    it('refuses an unknown status with 400', async () => {
      expect((await get(server, `${PATH}?status=hidden`, admin)).statusCode).toBe(400)
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await addGame({ name: 'Counter-Strike 2', aliases: ['cs2'], popularity: 9 })
      await addGame({ name: 'League of Legends', aliases: ['lol'], popularity: 8 })
      await addGame({ name: 'Counter Hidden', popularity: 1, listed: false })
    })

    it('matches the name, ignoring case, accents and punctuation, in delisted games too', async () => {
      expect(names(await list('?q=COUNTER'))).toEqual(['Counter-Strike 2', 'Counter Hidden'])
      expect(names(await list('?q=counter%20strike'))).toEqual(['Counter-Strike 2'])
    })

    it('matches an alias', async () => {
      expect(names(await list('?q=lol'))).toEqual(['League of Legends'])
    })

    it('treats a blank search as no filter and an unmatched one as empty', async () => {
      expect((await list('?q=%20%20')).total).toBe(3)
      expect(await list('?q=nothing-like-it')).toMatchObject({ items: [], total: 0 })
    })

    it('treats LIKE wildcards in the term as plain text', async () => {
      expect((await list('?q=%25')).total).toBe(3)
      expect((await list('?q=%25_')).total).toBe(3)
    })

    it('refuses a search over 100 characters with 400', async () => {
      expect((await get(server, `${PATH}?q=${'a'.repeat(101)}`, admin)).statusCode).toBe(400)
    })
  })

  describe('sort', () => {
    it('orders by name, A to Z', async () => {
      await addGame({ name: 'Charlie' })
      await addGame({ name: 'Alpha' })
      await addGame({ name: 'Bravo' })

      expect(names(await list('?sort=name'))).toEqual(['Alpha', 'Bravo', 'Charlie'])
    })

    it('orders by creation, newest first', async () => {
      const old = await addGame({ name: 'Old' })
      await addGame({ name: 'Recent' })
      await server.app.db
        .update(games)
        .set({ createdAt: new Date('2020-01-01T00:00:00.000Z') })
        .where(eq(games.id, old.id))

      expect(names(await list('?sort=newest'))).toEqual(['Recent', 'Old'])
    })

    it('orders by Open Squads and by completed Squads, most first', async () => {
      const first = await addGame({ name: 'First', popularity: 30 })
      const second = await addGame({ name: 'Second', popularity: 20 })
      const third = await addGame({ name: 'Third', popularity: 10 })
      await addOpenSquads(third.id, 2)
      await addOpenSquads(first.id, 1)
      await addCompleted(second.id, 4)
      await addCompleted(first.id, 1)

      expect(names(await list('?sort=openSquads'))).toEqual(['Third', 'First', 'Second'])
      expect(names(await list('?sort=completedSquads'))).toEqual(['Second', 'First', 'Third'])
    })

    it('breaks a tie on the game id so the order is stable', async () => {
      await addGame({ name: 'Twin', popularity: 1 })
      await addGame({ name: 'Twin', popularity: 1 })

      const first = (await list('?sort=name')).items.map((game) => game.id)
      const again = (await list('?sort=name')).items.map((game) => game.id)

      expect(first).toEqual(again)
      expect(first).toEqual([...first].sort())
    })

    it('refuses an unknown sort with 400', async () => {
      expect((await get(server, `${PATH}?sort=random`, admin)).statusCode).toBe(400)
    })
  })

  describe('pagination', () => {
    it('pages 20 at a time, never repeats a game and answers a page past the end empty', async () => {
      for (let index = 0; index < 25; index += 1) {
        await addGame({ name: `Game ${String(index).padStart(2, '0')}`, popularity: 100 - index })
      }

      const first = await list('?page=1')
      const second = await list('?page=2')
      const past = await list('?page=9')

      expect(first.items).toHaveLength(20)
      expect(second.items).toHaveLength(5)
      expect(new Set([...first.items, ...second.items].map((game) => game.id)).size).toBe(25)
      expect(past).toMatchObject({ items: [], page: 9, total: 25 })
    })

    it.each(['0', '-2', 'abc', '1.5'])('refuses page=%s with 400', async (page) => {
      expect((await get(server, `${PATH}?page=${page}`, admin)).statusCode).toBe(400)
    })

    it('counts the total of the filtered games, not of the page', async () => {
      for (let index = 0; index < 22; index += 1) {
        await addGame({ name: `Hidden ${index}`, listed: false })
      }
      await addGame({ name: 'Visible' })

      expect(await list('?status=delisted&page=2')).toMatchObject({ total: 22 })
    })
  })
})

describe('GET /api/admin/catalog/games/summary', () => {
  const STARTED = new Date('2026-11-05T04:00:00.000Z')
  const FINISHED = new Date('2026-11-05T04:00:04.000Z')
  const INSIDE = new Date('2026-11-05T04:00:02.000Z')
  const BEFORE = new Date('2026-11-04T04:00:02.000Z')

  async function summary() {
    const response = await get(server, `${PATH}/summary`, admin)
    expect(response.statusCode, response.body).toBe(200)
    return adminGamesSummarySchema.parse(response.json())
  }

  async function addRun(
    status: 'succeeded' | 'failed' | 'interrupted',
    startedAt: Date,
    finishedAt: Date
  ) {
    const [run] = await server.app.db
      .insert(catalogImportRuns)
      .values({ trigger: 'scheduled', status, requestedAt: startedAt, startedAt, finishedAt })
      .returning()
    if (!run) throw new Error('Failed to insert run')
    return run
  }

  async function stamp(gameId: string, createdAt: Date, updatedAt: Date) {
    await server.app.db.update(games).set({ createdAt, updatedAt }).where(eq(games.id, gameId))
  }

  it('counts an empty catalog and has no last import', async () => {
    expect(await summary()).toEqual({ listed: 0, delisted: 0, featured: 0, lastImport: null })
  })

  it('counts the listed, delisted and featured games', async () => {
    await addGame({ name: 'A' })
    await addGame({ name: 'B', featuredRank: 1 })
    await addGame({ name: 'C', listed: false })
    await addGame({ name: 'D', listed: false, featuredRank: 2 })

    expect(await summary()).toMatchObject({ listed: 2, delisted: 2, featured: 1, lastImport: null })
  })

  it('names the games that entered and left in the last finished run’s window', async () => {
    const run = await addRun('succeeded', STARTED, FINISHED)
    const entered = await addGame({ name: 'Entered' })
    const stale = await addGame({ name: 'Stale' })
    const left = await addGame({ name: 'Left', listed: false })
    const oldDelisted = await addGame({ name: 'Old delisted', listed: false })
    const relisted = await addGame({ name: 'Relisted' })
    await stamp(entered.id, INSIDE, INSIDE)
    await stamp(stale.id, BEFORE, BEFORE)
    await stamp(left.id, BEFORE, INSIDE)
    await stamp(oldDelisted.id, BEFORE, BEFORE)
    await stamp(relisted.id, BEFORE, INSIDE)

    const body = await summary()

    expect(body.lastImport).toEqual({
      runId: run.id,
      status: 'succeeded',
      finishedAt: FINISHED.toISOString(),
      entered: { total: 1, games: [{ id: entered.id, name: 'Entered' }] },
      left: { total: 1, games: [{ id: left.id, name: 'Left' }] },
    })
  })

  it('caps the names at five and keeps the real total', async () => {
    await addRun('succeeded', STARTED, FINISHED)
    for (let index = 0; index < 7; index += 1) {
      const game = await addGame({ name: `New ${index}` })
      await stamp(game.id, INSIDE, INSIDE)
    }

    const entered = (await summary()).lastImport?.entered

    expect(entered?.total).toBe(7)
    expect(entered?.games.map((game) => game.name)).toEqual([
      'New 0',
      'New 1',
      'New 2',
      'New 3',
      'New 4',
    ])
  })

  it.each(['failed', 'interrupted'] as const)(
    'reads the latest finished run, a later %s one, not the older succeeded one',
    async (status) => {
      await addRun('succeeded', STARTED, FINISHED)
      const later = await addRun(
        status,
        new Date('2026-11-06T04:00:00.000Z'),
        new Date('2026-11-06T04:00:04.000Z')
      )
      const old = await addGame({ name: 'Entered by the older run' })
      await stamp(old.id, INSIDE, INSIDE)

      const lastImport = (await summary()).lastImport

      expect(lastImport).toMatchObject({ runId: later.id, status })
      expect(lastImport?.entered.total).toBe(0)
      expect(lastImport?.left.total).toBe(0)
    }
  )

  it('reads an interrupted run that never started from its request time', async () => {
    const requestedAt = new Date('2026-11-06T04:00:00.000Z')
    const [run] = await server.app.db
      .insert(catalogImportRuns)
      .values({
        trigger: 'scheduled',
        status: 'interrupted',
        requestedAt,
        finishedAt: new Date('2026-11-06T04:00:10.000Z'),
      })
      .returning()
    if (!run) throw new Error('Failed to insert run')
    const entered = await addGame({ name: 'Entered while queued' })
    await stamp(entered.id, new Date('2026-11-06T04:00:05.000Z'), INSIDE)

    const lastImport = (await summary()).lastImport

    expect(lastImport).toMatchObject({ runId: run.id, status: 'interrupted' })
    expect(lastImport?.entered.games).toEqual([{ id: entered.id, name: 'Entered while queued' }])
  })

  it('ignores a queued or running run', async () => {
    const finished = await addRun('succeeded', STARTED, FINISHED)
    await server.app.db.insert(catalogImportRuns).values({
      trigger: 'manual',
      status: 'running',
      requestedAt: new Date('2026-11-06T04:00:00.000Z'),
      startedAt: new Date('2026-11-06T04:00:01.000Z'),
    })

    expect((await summary()).lastImport?.runId).toBe(finished.id)
  })
})

describe('GET /api/admin/catalog/games/:id', () => {
  async function detail(id: string, as: TestUser = admin) {
    const response = await get(server, `${PATH}/${id}`, as)
    expect(response.statusCode, response.body).toBe(200)
    return adminGameDetailResponseSchema.parse(response.json())
  }

  it('returns every field of a game with its usage and its Open Squads', async () => {
    const game = await addGame({
      name: 'Detail Game',
      aliases: ['dg'],
      genres: [{ slug: 'shooter', name: 'Shooter' }],
      igdbId: 4242,
      platforms: ['pc', 'ps5'],
      popularity: 77,
      featuredRank: 4,
    })
    await addCompleted(game.id, 2)
    const host = await signIn(server, 'Detail host')
    const squad = await createRoom(server, host, {
      gameId: game.id,
      maxPlayers: 5,
      platform: 'pc',
    })

    const body = await detail(game.id)

    expect(body.game).toMatchObject({
      id: game.id,
      name: 'Detail Game',
      igdbId: 4242,
      genres: [{ slug: 'shooter', name: 'Shooter' }],
      aliases: expect.arrayContaining(['dg']) as string[],
      coverUrl: game.coverUrl,
      platforms: ['pc', 'ps5'],
      popularity: 77,
      featuredRank: 4,
      listed: true,
      usage: { openSquads: 1, completedSquads: 2 },
      createdAt: game.createdAt,
    })
    expect(body.openSquads.map((openSquad) => openSquad.id)).toEqual([squad.id])
  })

  it('returns a delisted game without an IGDB id and with no Open Squads', async () => {
    const game = await addGame({ name: 'Legacy', listed: false })

    const body = await detail(game.id)

    expect(body.game).toMatchObject({ listed: false, igdbId: null, genres: [] })
    expect(body.openSquads).toEqual([])
  })

  it('lists at most 20 Open Squads, newest first, with the real count in the usage', async () => {
    const game = await addGame({ name: 'Crowded' })
    await addOpenSquads(game.id, 22)

    const body = await detail(game.id)

    expect(body.openSquads).toHaveLength(20)
    expect(body.game.usage.openSquads).toBe(22)
    const times = body.openSquads.map((squad) => squad.createdAt)
    expect(times).toEqual([...times].sort().reverse())
  })

  it('answers 404 GAME_NOT_FOUND for an unknown id and 400 for a malformed one', async () => {
    const unknown = await get(server, `${PATH}/${randomUUID()}`, admin)
    const malformed = await get(server, `${PATH}/not-a-uuid`, admin)

    expect(unknown.statusCode).toBe(404)
    expect(unknown.json()).toMatchObject({ error: 'GAME_NOT_FOUND' })
    expect(malformed.statusCode).toBe(400)
  })
})

describe('who may read the Games view', () => {
  let gameId: string

  beforeEach(async () => {
    gameId = (await addGame()).id
  })

  const paths = () => [PATH, `${PATH}/summary`, `${PATH}/${gameId}`]

  it('gives the owner every route too', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })

    for (const path of paths()) {
      expect((await get(server, path, owner)).statusCode, path).toBe(200)
    }
  })

  it('refuses a moderator with 403 ADMIN_REQUIRED, even with a bad query', async () => {
    const moderator = await signIn(server, 'Moderator', { role: 'moderator' })

    for (const path of paths()) {
      const response = await get(server, path, moderator)
      expect(response.statusCode, path).toBe(403)
      expect(response.json(), path).toMatchObject({ error: 'ADMIN_REQUIRED' })
    }
    expect((await get(server, `${PATH}?page=abc`, moderator)).statusCode).toBe(403)
  })

  it('refuses a user with 403 ADMIN_REQUIRED', async () => {
    const player = await signIn(server, 'Player')

    for (const path of paths()) {
      const response = await get(server, path, player)
      expect(response.statusCode, path).toBe(403)
      expect(response.json(), path).toMatchObject({ error: 'ADMIN_REQUIRED' })
    }
  })

  it('refuses a signed-out visitor with 401 UNAUTHORIZED', async () => {
    for (const path of paths()) {
      const response = await get(server, path)
      expect(response.statusCode, path).toBe(401)
      expect(response.json(), path).toMatchObject({ error: 'UNAUTHORIZED' })
    }
  })
})
