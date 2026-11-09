import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogImportRunsResponseSchema, type CatalogImportRunDto } from '@squadzr/schemas'
import { eq } from 'drizzle-orm'
import { buildApp } from '@/app'
import { auditEntries, catalogImportRuns, games } from '@infrastructure/database/schema'
import { DrizzleCatalogImportRunRepository } from '@infrastructure/repositories/drizzle-catalog-import-run.repository'
import { signIn, type TestUser } from '@test/harness/auth'
import { createCandidate, FakeGameCatalogSource } from '@test/harness/game-catalog-source'
import { get, insertGame } from '@test/harness/rooms'
import { buildTestServer, createTestEnv, KNOWN_INVITES } from '@test/harness/test-server'
import type { TestServer } from '@test/harness/test-server'

// #123: POST /api/admin/catalog-import/runs queues a manual Catalog Import Run (admin or owner only) and
// an executor inside the API runs it through the shared run recorder. A fake catalog source keeps every
// run offline; manual-limit scenarios write their runs directly with instants relative to now.

const PATH = '/api/admin/catalog-import/runs'
const HOUR = 3_600_000

let server: TestServer
let source: FakeGameCatalogSource
let admin: TestUser

/** Enough candidates to clear the import's absolute floor of 10. */
function candidates(count: number) {
  return Array.from({ length: count }, (_, index) =>
    createCandidate({
      igdbId: 5000 + index,
      name: `Fake Game ${index}`,
      slug: `fake-game-${index}`,
    })
  )
}

beforeEach(async () => {
  source = new FakeGameCatalogSource().withCandidates(candidates(12))
  server = await buildTestServer({}, { catalogSource: source })
  admin = await signIn(server, 'Ada Admin', { role: 'admin' })
})

afterEach(async () => {
  await server.close()
})

function request(as: TestUser | null = admin, body?: unknown) {
  return server.app.inject({
    method: 'POST',
    url: PATH,
    headers: as?.headers,
    ...(body === undefined ? {} : { payload: body as object }),
  })
}

async function runRows() {
  return server.app.db.select().from(catalogImportRuns)
}

async function waitForFinished(runId: string) {
  return vi.waitFor(
    async () => {
      const [row] = await server.app.db
        .select()
        .from(catalogImportRuns)
        .where(eq(catalogImportRuns.id, runId))
      expect(['requested', 'running']).not.toContain(row?.status)
      return row!
    },
    { timeout: 10_000, interval: 25 }
  )
}

async function writeRun(values: Partial<typeof catalogImportRuns.$inferInsert>) {
  const requestedAt = values.requestedAt ?? new Date()
  await server.app.db.insert(catalogImportRuns).values({
    trigger: 'manual',
    status: 'failed',
    requestedAt,
    startedAt: requestedAt,
    finishedAt: new Date(requestedAt.getTime() + 4_000),
    errorMessage: 'IGDB is unavailable',
    ...values,
  })
}

describe('POST /api/admin/catalog-import/runs', () => {
  describe('roles', () => {
    it('refuses a signed-out visitor with 401', async () => {
      expect((await request(null)).statusCode).toBe(401)
      expect(await runRows()).toHaveLength(0)
    })

    it.each(['user', 'moderator'] as const)(
      'refuses a %s with 403 ADMIN_REQUIRED',
      async (role) => {
        const refused = await signIn(server, `A ${role}`, { role })

        const response = await request(refused)

        expect(response.statusCode).toBe(403)
        expect(response.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
        expect(await runRows()).toHaveLength(0)
        expect(await server.app.db.select().from(auditEntries)).toHaveLength(0)
      }
    )

    it('accepts the owner', async () => {
      const owner = await signIn(server, 'Olive Owner', { role: 'owner' })

      const response = await request(owner)

      expect(response.statusCode, response.body).toBe(202)
      expect(response.json()).toMatchObject({ requestedBy: { id: owner.id, name: 'Olive Owner' } })
    })
  })

  describe('a manual run', () => {
    it('answers 202 with the queued run and runs end to end with the fake source', async () => {
      const response = await request()

      expect(response.statusCode, response.body).toBe(202)
      const queued = response.json<CatalogImportRunDto>()
      expect(queued).toMatchObject({
        trigger: 'manual',
        status: 'requested',
        requestedBy: { id: admin.id, name: 'Ada Admin' },
        startedAt: null,
        finishedAt: null,
        summary: null,
      })

      const finished = await waitForFinished(queued.id)
      expect(finished).toMatchObject({
        status: 'succeeded',
        trigger: 'manual',
        requestedById: admin.id,
        requestedByName: 'Ada Admin',
        created: 12,
        received: 12,
        listedGames: 12,
        errorMessage: null,
      })
      expect(finished.startedAt).not.toBeNull()
      expect(finished.finishedAt).not.toBeNull()
      expect(source.calls).toBe(1)
      expect(await server.app.db.select().from(games)).toHaveLength(12)
    })

    it('writes one catalog_import_requested audit entry with the actor and the run id', async () => {
      const queued = (await request()).json<CatalogImportRunDto>()
      await waitForFinished(queued.id)

      const entries = await server.app.db.select().from(auditEntries)

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        action: 'catalog_import_requested',
        actorId: admin.id,
        actorName: 'Ada Admin',
        target: null,
        reason: null,
        details: { runId: queued.id },
      })
    })

    it('records a failing source as a failed run, not an error of the request', async () => {
      source.failWith(new Error('IGDB is unavailable'))

      const queued = (await request()).json<CatalogImportRunDto>()
      const finished = await waitForFinished(queued.id)

      expect(finished).toMatchObject({
        status: 'failed',
        errorMessage: 'IGDB is unavailable',
        requestedById: admin.id,
      })
    })
  })

  describe('the fraction check', () => {
    beforeEach(async () => {
      // 30 Listed Games today: 12 candidates are below the 50% fraction but above the absolute floor.
      for (let index = 0; index < 30; index += 1) await insertGame(server, { listed: true })
    })

    it('cannot be bypassed from the request: a body is ignored and the run stops on the fraction check', async () => {
      const response = await request(admin, { overrideFractionCheck: true })

      expect(response.statusCode, response.body).toBe(202)
      const finished = await waitForFinished(response.json<CatalogImportRunDto>().id)
      expect(finished.status).toBe('safety_stop')
      expect(finished.errorMessage).toContain('below 50%')
      expect(await server.app.db.select().from(games)).toHaveLength(30)
    })

    it('cannot be bypassed from a query string either', async () => {
      const response = await server.app.inject({
        method: 'POST',
        url: `${PATH}?overrideFractionCheck=true`,
        headers: admin.headers,
      })

      const finished = await waitForFinished(response.json<CatalogImportRunDto>().id)
      expect(finished.status).toBe('safety_stop')
    })
  })

  describe('the 24 hour limit', () => {
    it.each(['failed', 'interrupted', 'safety_stop', 'succeeded'] as const)(
      'refuses a second request after a manual run that ended %s',
      async (status) => {
        await writeRun({ status, requestedAt: new Date(Date.now() - HOUR) })

        const response = await request()

        expect(response.statusCode).toBe(422)
        expect(response.json()).toMatchObject({ error: 'CATALOG_IMPORT_MANUAL_LIMIT' })
        expect(await runRows()).toHaveLength(1)
        expect(await server.app.db.select().from(auditEntries)).toHaveLength(0)
      }
    )

    it('counts a manual run requested by another admin', async () => {
      const other = await signIn(server, 'Other Admin', { role: 'admin' })
      await writeRun({ requestedById: other.id, requestedByName: 'Other Admin' })

      expect((await request()).statusCode).toBe(422)
    })

    it('accepts a request once the last manual one is more than 24 hours old', async () => {
      await writeRun({ requestedAt: new Date(Date.now() - 25 * HOUR) })

      const response = await request()

      expect(response.statusCode, response.body).toBe(202)
    })

    it('is not blocked by a scheduled run inside those 24 hours', async () => {
      await writeRun({
        trigger: 'scheduled',
        status: 'succeeded',
        requestedAt: new Date(Date.now() - HOUR),
      })

      const response = await request()

      expect(response.statusCode, response.body).toBe(202)
    })
  })

  describe('the run slot', () => {
    it('refuses with 422 CATALOG_IMPORT_RUNNING while a scheduled run is running', async () => {
      await writeRun({
        trigger: 'scheduled',
        status: 'running',
        requestedAt: new Date(),
        heartbeatAt: new Date(),
        finishedAt: null,
      })

      const response = await request()

      expect(response.statusCode).toBe(422)
      expect(response.json()).toMatchObject({ error: 'CATALOG_IMPORT_RUNNING' })
      expect(await server.app.db.select().from(auditEntries)).toHaveLength(0)
    })

    it('refuses with 422 CATALOG_IMPORT_RUNNING while the manual run just requested is still active', async () => {
      const first = await request()
      expect(first.statusCode, first.body).toBe(202)

      const second = await request()

      expect(second.statusCode).toBe(422)
      expect(second.json()).toMatchObject({ error: 'CATALOG_IMPORT_RUNNING' })
      await waitForFinished(first.json<CatalogImportRunDto>().id)
    })

    it('lets exactly one of two simultaneous requests queue', async () => {
      const [first, second] = await Promise.all([request(), request()])

      expect([first.statusCode, second.statusCode].sort()).toEqual([202, 422])
      const refused = first.statusCode === 422 ? first : second
      expect(['CATALOG_IMPORT_RUNNING', 'CATALOG_IMPORT_MANUAL_LIMIT']).toContain(
        refused.json<{ error: string }>().error
      )
      const accepted = first.statusCode === 202 ? first : second
      await waitForFinished(accepted.json<CatalogImportRunDto>().id)
      expect(await runRows()).toHaveLength(1)
      expect(await server.app.db.select().from(auditEntries)).toHaveLength(1)
    })
  })

  describe('without IGDB credentials', () => {
    it('answers 503 CATALOG_IMPORT_UNAVAILABLE and records nothing', async () => {
      const bare = await buildTestServer()
      try {
        const bareAdmin = await signIn(bare, 'Bare Admin', { role: 'admin' })

        const response = await bare.app.inject({
          method: 'POST',
          url: PATH,
          headers: bareAdmin.headers,
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toMatchObject({ error: 'CATALOG_IMPORT_UNAVAILABLE' })
        expect(await bare.app.db.select().from(catalogImportRuns)).toHaveLength(0)
        expect(await bare.app.db.select().from(auditEntries)).toHaveLength(0)
      } finally {
        await bare.close()
      }
    })
  })
})

describe('the executor', () => {
  it('starts a requested run left by a restart after boot', async () => {
    const bare = await buildTestServer()
    try {
      const bareAdmin = await signIn(bare, 'Bare Admin', { role: 'admin' })
      const requestedAt = new Date(Date.now() - 60_000)
      const [left] = await bare.app.db
        .insert(catalogImportRuns)
        .values({
          trigger: 'manual',
          status: 'requested',
          requestedAt,
          requestedById: bareAdmin.id,
          requestedByName: 'Bare Admin',
        })
        .returning()

      const restarted = await buildApp({
        env: createTestEnv({ DATABASE_URL: bare.databaseUrl }),
        discordPreviews: KNOWN_INVITES,
        catalogSource: new FakeGameCatalogSource().withCandidates(candidates(12)),
      })
      try {
        await restarted.ready()

        const finished = await vi.waitFor(
          async () => {
            const [row] = await bare.app.db
              .select()
              .from(catalogImportRuns)
              .where(eq(catalogImportRuns.id, left!.id))
            expect(row?.status).toBe('succeeded')
            return row!
          },
          { timeout: 10_000, interval: 25 }
        )
        expect(finished.requestedById).toBe(bareAdmin.id)
        expect(finished.startedAt).not.toBeNull()
      } finally {
        await restarted.close()
      }
    } finally {
      await bare.close()
    }
  })

  it('never lets two executors run the same row: of concurrent claims exactly one wins', async () => {
    const bare = await buildTestServer()
    try {
      await bare.app.db
        .insert(catalogImportRuns)
        .values({ trigger: 'manual', status: 'requested', requestedAt: new Date() })
      const repositories = Array.from(
        { length: 8 },
        () => new DrizzleCatalogImportRunRepository(bare.app.db)
      )

      const claims = await Promise.all(
        repositories.map((repository) => repository.claimRequested(new Date()))
      )

      expect(claims.filter((claim) => claim !== null)).toHaveLength(1)
      const [row] = await bare.app.db.select().from(catalogImportRuns)
      expect(row).toMatchObject({ status: 'running' })
      expect(row?.startedAt).not.toBeNull()
      expect(row?.heartbeatAt).not.toBeNull()
    } finally {
      await bare.close()
    }
  })

  it('claims nothing when no run is queued, and not a run that is already running', async () => {
    const bare = await buildTestServer()
    try {
      const repository = new DrizzleCatalogImportRunRepository(bare.app.db)
      expect(await repository.claimRequested(new Date())).toBeNull()

      await bare.app.db.insert(catalogImportRuns).values({
        trigger: 'scheduled',
        status: 'running',
        requestedAt: new Date(),
        startedAt: new Date(),
        heartbeatAt: new Date(),
      })
      expect(await repository.claimRequested(new Date())).toBeNull()
    } finally {
      await bare.close()
    }
  })
})

describe('GET /api/admin/catalog-import/runs', () => {
  async function list() {
    const response = await get(server, PATH, admin)
    expect(response.statusCode, response.body).toBe(200)
    return catalogImportRunsResponseSchema.parse(response.json())
  }

  it('is available with no active run before any manual request', async () => {
    expect(await list()).toMatchObject({ manualRun: { available: true }, activeRun: null })
  })

  it('says when a manual run is available again, 24 hours after the last request, and ignores scheduled runs', async () => {
    const requestedAt = new Date(Date.now() - 2 * HOUR)
    await writeRun({ requestedAt })
    await writeRun({ trigger: 'scheduled', status: 'succeeded', requestedAt: new Date() })

    const body = await list()

    expect(body.manualRun).toEqual({
      available: false,
      availableAt: new Date(requestedAt.getTime() + 24 * HOUR).toISOString(),
    })
    expect(body.activeRun).toBeNull()
  })

  it('is available again once the last manual request is 24 hours old', async () => {
    await writeRun({ requestedAt: new Date(Date.now() - 24 * HOUR - 1_000) })

    expect((await list()).manualRun).toEqual({ available: true })
  })

  it('carries the run holding the slot on any page', async () => {
    await writeRun({
      status: 'running',
      requestedAt: new Date(),
      heartbeatAt: new Date(),
      finishedAt: null,
    })

    const page = await get(server, `${PATH}?page=3`, admin)
    const body = catalogImportRunsResponseSchema.parse(page.json())

    expect(body.items).toEqual([])
    expect(body.activeRun).toMatchObject({ status: 'running', trigger: 'manual' })
  })
})
