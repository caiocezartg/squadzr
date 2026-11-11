import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { catalogImportRunsResponseSchema, PAGE_SIZE } from '@squadzr/schemas'
import { eq } from 'drizzle-orm'
import { catalogImportRuns, user } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import { get } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #122: GET /api/admin/catalog-import/runs lists the Catalog Import Runs newest first through the shared
// pagination contract. It is an admin-or-owner route: a moderator, a user and a signed-out visitor are
// refused before the query is read.

const START = new Date('2026-11-01T04:00:00.000Z')
const PATH = '/api/admin/catalog-import/runs'

let server: TestServer
let admin: TestUser

beforeEach(async () => {
  server = await buildTestServer()
  admin = await signIn(server, 'Admin', { role: 'admin' })
})

afterEach(async () => {
  await server.close()
})

type RunStatus = typeof catalogImportRuns.$inferInsert.status

/** One run per day, oldest first; every run is finished, so the single-slot index never interferes. */
async function writeRuns(count: number, status: RunStatus = 'failed'): Promise<Date[]> {
  const requestedAts: Date[] = []
  for (let index = 0; index < count; index += 1) {
    const requestedAt = new Date(START.getTime() + index * 86_400_000)
    requestedAts.push(requestedAt)
    await server.app.db.insert(catalogImportRuns).values({
      trigger: 'scheduled',
      status,
      requestedAt,
      startedAt: requestedAt,
      finishedAt: new Date(requestedAt.getTime() + 4_000),
      errorMessage: 'IGDB is unavailable',
    })
  }
  return requestedAts
}

async function list(page?: number) {
  const response = await get(server, `${PATH}${page ? `?page=${page}` : ''}`, admin)
  expect(response.statusCode, response.body).toBe(200)
  return catalogImportRunsResponseSchema.parse(response.json())
}

describe('GET /api/admin/catalog-import/runs', () => {
  it('answers an empty first page with the real total when nothing was recorded', async () => {
    expect(await list()).toEqual({
      items: [],
      page: 1,
      pageSize: PAGE_SIZE,
      total: 0,
      manualRun: { available: true },
      activeRun: null,
    })
  })

  it('lists the runs newest first with the shared pagination envelope', async () => {
    const requestedAts = await writeRuns(3)

    const body = await list()

    expect(body).toMatchObject({ page: 1, pageSize: 20, total: 3 })
    expect(body.items.map((run) => run.requestedAt)).toEqual(
      [...requestedAts].reverse().map((instant) => instant.toISOString())
    )
  })

  it('pages through 20 runs at a time and answers a page past the end empty', async () => {
    await writeRuns(25)

    const first = await list(1)
    const second = await list(2)
    const past = await list(9)

    expect(first.items).toHaveLength(20)
    expect(second.items).toHaveLength(5)
    expect(past).toMatchObject({ items: [], page: 9, total: 25 })
  })

  it.each(['0', '-2', 'abc', '1.5'])('refuses page=%s with 400', async (page) => {
    const response = await get(server, `${PATH}?page=${page}`, admin)

    expect(response.statusCode).toBe(400)
  })

  it('carries the summary of a succeeded run, the error of a stopped one and a queued run', async () => {
    const db = server.app.db
    await db.insert(catalogImportRuns).values({
      trigger: 'scheduled',
      status: 'succeeded',
      requestedAt: new Date(START.getTime()),
      startedAt: new Date(START.getTime()),
      finishedAt: new Date(START.getTime() + 4_000),
      created: 4,
      updated: 10,
      delisted: 1,
      relisted: 2,
      received: 16,
      dropped: 1,
      invalid: 3,
      listedGames: 1675,
    })
    await db.insert(catalogImportRuns).values({
      trigger: 'scheduled',
      status: 'safety_stop',
      requestedAt: new Date(START.getTime() + 86_400_000),
      startedAt: new Date(START.getTime() + 86_400_000),
      finishedAt: new Date(START.getTime() + 86_404_000),
      listedGames: 1675,
      errorMessage: 'Catalog Import received 3 candidates',
    })
    await db.insert(catalogImportRuns).values({
      trigger: 'manual',
      requestedById: admin.id,
      requestedByName: admin.name,
      status: 'requested',
      requestedAt: new Date(START.getTime() + 2 * 86_400_000),
    })

    const { items } = await list()

    expect(items.map((run) => run.status)).toEqual(['requested', 'safety_stop', 'succeeded'])
    expect(items[0]).toMatchObject({
      trigger: 'manual',
      requestedBy: { id: admin.id, name: 'Admin' },
      startedAt: null,
      finishedAt: null,
      summary: null,
      listedGames: null,
    })
    expect(items[1]).toMatchObject({
      summary: null,
      listedGames: 1675,
      errorMessage: 'Catalog Import received 3 candidates',
    })
    expect(items[2]).toMatchObject({
      trigger: 'scheduled',
      requestedBy: null,
      summary: {
        created: 4,
        updated: 10,
        delisted: 1,
        relisted: 2,
        received: 16,
        dropped: 1,
        invalid: 3,
      },
      listedGames: 1675,
      errorMessage: null,
    })
  })

  it('keeps the name of a requesting admin whose account is gone', async () => {
    const former = await signIn(server, 'Former admin', { role: 'admin' })
    await server.app.db.insert(catalogImportRuns).values({
      trigger: 'manual',
      requestedById: former.id,
      requestedByName: former.name,
      status: 'failed',
      requestedAt: START,
    })

    await server.app.db.delete(user).where(eq(user.id, former.id))

    const { items } = await list()
    expect(items[0]?.requestedBy).toEqual({ id: null, name: 'Former admin' })
  })
})

describe('who may read GET /api/admin/catalog-import/runs', () => {
  it('gives the owner the history too', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })

    const response = await get(server, PATH, owner)

    expect(response.statusCode).toBe(200)
  })

  it('refuses a moderator with 403 ADMIN_REQUIRED, even with a bad query', async () => {
    const moderator = await signIn(server, 'Moderator', { role: 'moderator' })

    const response = await get(server, PATH, moderator)
    const badQuery = await get(server, `${PATH}?page=abc`, moderator)

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
    expect(badQuery.statusCode).toBe(403)
  })

  it('refuses a user with 403 ADMIN_REQUIRED', async () => {
    const player = await signIn(server, 'Player')

    const response = await get(server, PATH, player)

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
  })

  it('refuses a signed-out visitor with 401 UNAUTHORIZED', async () => {
    const response = await get(server, PATH)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ error: 'UNAUTHORIZED' })
  })
})
