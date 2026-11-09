import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  activityResponseSchema,
  OVERVIEW_AUDIT_LIMIT,
  overviewResponseSchema,
  type ActivityMetric,
  type OverviewPeriod,
} from '@squadzr/schemas'
import {
  activitySamples,
  catalogImportRuns,
  squadRecords,
  user,
} from '@infrastructure/database/schema'
import { runActivitySample } from '@infrastructure/plugins/activity-sampler.plugin'
import { createRunActivitySampleUseCase } from '@interface/factories/activity-sampler.factory'
import { insertAuditEntry } from '@infrastructure/repositories/audit-entry-writer'
import { createMockClock, type MockClock } from '@test/mocks'
import { signIn, type TestUser } from '@test/harness/auth'
import { connect, type RealtimeSession } from '@test/harness/realtime'
import { createRoom, get, insertGame, setRoomLifecycle } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #120: GET /api/admin/overview and GET /api/admin/activity with a fixed clock. The clock reads
// 2026-11-05 12:00 in Sao Paulo (15:00 UTC), so the 7-day period is Oct 30 to Nov 5, the 30-day
// one Oct 7 to Nov 5 and the 90-day one Aug 8 to Nov 5.

const NOW = new Date('2026-11-05T15:00:00.000Z')
const LONG_AGO = new Date('2025-01-01T12:00:00.000Z')

// Instants chosen around the day boundaries of Sao Paulo (UTC-3).
const MIDNIGHT_SAO_PAULO = new Date('2026-11-05T03:00:00.000Z') // Nov 5 00:00 local: today
const JUST_BEFORE_MIDNIGHT = new Date('2026-11-05T02:59:59.000Z') // Nov 4 23:59:59 local: yesterday
const WEEK_START = new Date('2026-10-30T12:00:00.000Z') // first day of the 7-day period
const BEFORE_WEEK = new Date('2026-10-29T12:00:00.000Z') // last day before it
const MONTH_END = new Date('2026-10-06T12:00:00.000Z') // last day of the previous 30-day period
const IN_NINETY = new Date('2026-08-10T12:00:00.000Z') // inside the 90-day period only
const BEFORE_NINETY = new Date('2026-06-01T12:00:00.000Z') // inside the previous 90-day period

const EVENTS = [
  MIDNIGHT_SAO_PAULO,
  JUST_BEFORE_MIDNIGHT,
  WEEK_START,
  BEFORE_WEEK,
  MONTH_END,
  IN_NINETY,
  BEFORE_NINETY,
]

let server: TestServer
let clock: MockClock
let admin: TestUser
let moderator: TestUser
const sessions: RealtimeSession[] = []

beforeEach(async () => {
  clock = createMockClock(NOW)
  server = await buildTestServer({}, { clock })
  admin = await signIn(server, 'Admin', { role: 'admin' })
  moderator = await signIn(server, 'Moderator', { role: 'moderator' })
  await setCreatedAt(admin, LONG_AGO)
  await setCreatedAt(moderator, LONG_AGO)
})

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server.close()
})

async function setCreatedAt(person: TestUser, createdAt: Date): Promise<void> {
  await server.app.db.update(user).set({ createdAt }).where(eq(user.id, person.id))
}

/** One sign-up per event instant. */
async function seedSignups(): Promise<void> {
  for (const [index, createdAt] of EVENTS.entries()) {
    await setCreatedAt(await signIn(server, `Signup ${index}`), createdAt)
  }
}

/** One Squad Record per event instant, and a second one at the first instant. */
async function seedCompleted(): Promise<void> {
  const game = await insertGame(server)
  for (const readyAt of [...EVENTS, MIDNIGHT_SAO_PAULO]) {
    await server.app.db
      .insert(squadRecords)
      .values({ roomId: randomUUID(), gameId: game.id, name: 'Squad', maxPlayers: 5, readyAt })
  }
}

async function overview(period: OverviewPeriod | string, as: TestUser = admin) {
  const response = await get(server, `/api/admin/overview?period=${period}`, as)
  expect(response.statusCode, response.body).toBe(200)
  return overviewResponseSchema.parse(response.json())
}

async function activity(metric: ActivityMetric, period: OverviewPeriod, as: TestUser = admin) {
  const response = await get(server, `/api/admin/activity?metric=${metric}&period=${period}`, as)
  expect(response.statusCode, response.body).toBe(200)
  return activityResponseSchema.parse(response.json())
}

describe('the period values of GET /api/admin/overview', () => {
  beforeEach(async () => {
    await seedSignups()
    await seedCompleted()
  })

  it.each([
    [7, { current: 3, previous: 1 }, { current: 4, previous: 1 }],
    [30, { current: 4, previous: 1 }, { current: 5, previous: 1 }],
    [90, { current: 6, previous: 1 }, { current: 7, previous: 1 }],
  ] as const)(
    'compares the %i days with the period before them, by Sao Paulo day',
    async (period, signups, completed) => {
      const { metrics } = await overview(period)

      expect(metrics.signups).toEqual(signups)
      expect(metrics.completed).toEqual(completed)
    }
  )

  it('counts the live numbers whatever the period', async () => {
    const { live } = await overview(7)

    expect(live).toMatchObject({ totalUsers: 2 + EVENTS.length, completedSquads: 8 })
  })

  it('defaults to 30 days', async () => {
    const response = await get(server, '/api/admin/overview', admin)

    expect(overviewResponseSchema.parse(response.json()).period).toBe(30)
  })
})

describe('the live numbers of GET /api/admin/overview', () => {
  it('counts only the Open Squads that are still valid', async () => {
    const game = await insertGame(server)
    const [open, expired, ready] = await Promise.all(
      ['Open host', 'Expired host', 'Ready host'].map((name) => signIn(server, name))
    )
    const rooms = [
      await createRoom(server, open!, { gameId: game.id }),
      await createRoom(server, expired!, { gameId: game.id }),
      await createRoom(server, ready!, { gameId: game.id }),
    ]
    const day = 24 * 60 * 60_000
    await setRoomLifecycle(server, rooms[0]!.id, {
      createdAt: NOW,
      lastActivityAt: new Date(NOW.getTime() - day + 1_000),
      readyAt: null,
    })
    await setRoomLifecycle(server, rooms[1]!.id, {
      createdAt: new Date(NOW.getTime() - 2 * day),
      lastActivityAt: new Date(NOW.getTime() - day),
      readyAt: null,
    })
    await setRoomLifecycle(server, rooms[2]!.id, {
      createdAt: NOW,
      lastActivityAt: NOW,
      readyAt: NOW,
    })

    expect((await overview(7)).live.openSquads).toBe(1)
  })

  it('counts each signed-in user once across their connections and ignores guests', async () => {
    const [first, second] = await Promise.all([signIn(server, 'One'), signIn(server, 'Two')])
    for (const person of [first!, first!, second!, null, null]) {
      sessions.push(await connect(server, person))
    }

    expect((await overview(7)).live.onlineUsers).toBe(2)

    sessions.splice(0, 2).forEach((session) => session.client.terminate())
    await server.app.realtime.drain()
    await new Promise<void>((resolve) => setTimeout(resolve, 50))

    expect((await overview(7)).live.onlineUsers).toBe(1)
  })
})

describe('the recent audit of GET /api/admin/overview', () => {
  async function writeEntries(count: number): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await insertAuditEntry(server.app.db, {
        actorId: admin.id,
        actorName: admin.name,
        action: 'admin_granted',
        target: { type: 'user', id: randomUUID(), name: `Target ${index}` },
        reason: null,
        details: { oldRole: 'user', newRole: 'admin' },
        createdAt: new Date(NOW.getTime() - (count - index) * 60_000),
      })
    }
  }

  it('lists the latest 5 entries for an admin, newest first', async () => {
    await writeEntries(7)

    const { recentAudit } = await overview(7)

    expect(recentAudit).toHaveLength(OVERVIEW_AUDIT_LIMIT)
    expect(recentAudit?.map((entry) => entry.target?.type === 'user' && entry.target.name)).toEqual(
      ['Target 6', 'Target 5', 'Target 4', 'Target 3', 'Target 2']
    )
  })

  it('gives an owner the entries and a moderator none', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })
    await writeEntries(2)

    expect((await overview(7, owner)).recentAudit).toHaveLength(2)
    const asModerator = await get(server, '/api/admin/overview?period=7', moderator)
    expect(asModerator.statusCode).toBe(200)
    expect(asModerator.json()).toMatchObject({ recentAudit: null })
  })
})

describe('the last Catalog Import Run of GET /api/admin/overview', () => {
  it('is empty for an admin before any run was recorded', async () => {
    expect((await overview(7)).catalogImport).toEqual({ lastRun: null })
  })

  it('shows an admin and the owner the newest run, whatever its status', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })
    await server.app.db.insert(catalogImportRuns).values({
      trigger: 'scheduled',
      status: 'succeeded',
      requestedAt: new Date(NOW.getTime() - 86_400_000),
      startedAt: new Date(NOW.getTime() - 86_400_000),
      finishedAt: new Date(NOW.getTime() - 86_396_000),
      created: 1,
      updated: 2,
      delisted: 3,
      relisted: 4,
      received: 5,
      dropped: 0,
      invalid: 0,
      listedGames: 42,
    })
    await server.app.db.insert(catalogImportRuns).values({
      trigger: 'scheduled',
      status: 'running',
      requestedAt: NOW,
      startedAt: NOW,
      heartbeatAt: NOW,
    })

    for (const viewer of [admin, owner]) {
      expect((await overview(7, viewer)).catalogImport?.lastRun).toMatchObject({
        status: 'running',
        requestedAt: NOW.toISOString(),
        summary: null,
      })
    }
  })

  it('is left out for a moderator', async () => {
    const asModerator = await get(server, '/api/admin/overview?period=7', moderator)

    expect(asModerator.statusCode).toBe(200)
    expect(asModerator.json()).toMatchObject({ catalogImport: null })
  })
})

describe('GET /api/admin/activity', () => {
  beforeEach(async () => {
    await seedSignups()
    await seedCompleted()
  })

  it.each([7, 30, 90] as const)(
    'has exactly %i rows ending today, oldest first',
    async (period) => {
      const { rows } = await activity('signups', period)

      expect(rows).toHaveLength(period)
      expect(rows.at(-1)?.date).toBe('2026-11-05')
      expect(rows.map((row) => row.date)).toEqual([...rows.map((row) => row.date)].sort())
    }
  )

  it('buckets by Sao Paulo day around midnight UTC', async () => {
    const { rows } = await activity('completed', 7)
    const byDate = new Map(rows.map((row) => [row.date, row]))

    // 03:00:00Z and a second record at the same instant are Nov 5 (paired with Oct 29's record); 02:59:59Z is still Nov 4.
    expect(byDate.get('2026-11-05')).toEqual({ date: '2026-11-05', current: 2, previous: 1 })
    expect(byDate.get('2026-11-04')).toEqual({ date: '2026-11-04', current: 1, previous: 0 })
    expect(byDate.get('2026-10-30')).toEqual({ date: '2026-10-30', current: 1, previous: 0 })
    expect(byDate.get('2026-10-31')).toEqual({ date: '2026-10-31', current: 0, previous: 0 })
  })

  it('takes a record at 23:30 or 00:30 UTC from the Sao Paulo day, not the UTC one', async () => {
    const game = await insertGame(server)
    for (const readyAt of ['2026-11-04T23:30:00.000Z', '2026-11-05T00:30:00.000Z']) {
      await server.app.db.insert(squadRecords).values({
        roomId: randomUUID(),
        gameId: game.id,
        name: 'Squad',
        maxPlayers: 5,
        readyAt: new Date(readyAt),
      })
    }

    const { rows } = await activity('completed', 7)
    const byDate = new Map(rows.map((row) => [row.date, row.current]))

    // Both instants are Nov 4 in Sao Paulo (20:30 and 21:30), on top of the one seeded there.
    expect(byDate.get('2026-11-04')).toBe(3)
    expect(byDate.get('2026-11-05')).toBe(2)
  })

  it('pairs each day with the day one period earlier', async () => {
    const { rows } = await activity('signups', 7)

    // Oct 29 (BEFORE_WEEK) is the day right before the period, so it pairs with Nov 5.
    expect(rows.at(-1)).toEqual({ date: '2026-11-05', current: 1, previous: 1 })
  })

  it('matches the totals of the overview', async () => {
    const { rows } = await activity('completed', 30)
    const { metrics } = await overview(30)

    expect(rows.reduce((sum, row) => sum + (row.current ?? 0), 0)).toBe(metrics.completed.current)
    expect(rows.reduce((sum, row) => sum + (row.previous ?? 0), 0)).toBe(metrics.completed.previous)
  })
})

// #121: the peaks come from Activity Samples taken by `runActivitySample` (the timer is not involved).
describe('the peaks of the sampled metrics', () => {
  const day = (iso: string) => new Date(iso)

  async function sampleAt(instant: Date): Promise<void> {
    clock.set(instant)
    await runActivitySample(
      server.app.log,
      createRunActivitySampleUseCase(server.app.db, server.app.clock, server.app.realtime.manager)
    )
  }

  async function disconnect(session: RealtimeSession): Promise<void> {
    session.client.terminate()
    sessions.splice(sessions.indexOf(session), 1)
    await server.app.realtime.drain()
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
  }

  /**
   * Six samples across the periods (Sao Paulo days in brackets):
   *   Oct 29 12:00Z [Oct 29]  0 online, 0 open
   *   Nov  1 12:00Z [Nov 1]   1 online, 0 open
   *   Nov  4 12:00Z [Nov 4]   2 online, 1 open
   *   Nov  5 02:59:59Z [Nov 4] 3 online, 1 open
   *   Nov  5 03:00Z [Nov 5]   3 online, 2 open
   *   Nov  5 14:00Z [Nov 5]   2 online, 1 open (the first Squad has been idle for 26 hours)
   */
  async function seedSamples(): Promise<void> {
    const [first, second, third, host, otherHost] = await Promise.all(
      ['One', 'Two', 'Three', 'Host', 'Other host'].map((name) => signIn(server, name))
    )
    const game = await insertGame(server)

    await sampleAt(day('2026-10-29T12:00:00.000Z'))
    sessions.push(await connect(server, first!))
    await sampleAt(day('2026-11-01T12:00:00.000Z'))

    clock.set(day('2026-11-04T12:00:00.000Z'))
    await createRoom(server, host!, { gameId: game.id })
    sessions.push(await connect(server, second!))
    await sampleAt(day('2026-11-04T12:00:00.000Z'))

    const lastToConnect = await connect(server, third!)
    sessions.push(lastToConnect)
    await sampleAt(day('2026-11-05T02:59:59.000Z'))

    clock.set(day('2026-11-05T03:00:00.000Z'))
    await createRoom(server, otherHost!, { gameId: game.id })
    await sampleAt(day('2026-11-05T03:00:00.000Z'))

    await disconnect(lastToConnect)
    await sampleAt(day('2026-11-05T14:00:00.000Z'))
  }

  it('stores one sample per run with the current counts', async () => {
    await seedSamples()

    const rows = await server.app.db.select().from(activitySamples)

    expect(rows).toHaveLength(6)
    expect(
      rows
        .map((row) => [row.sampledAt.toISOString(), row.onlineUsers, row.openSquads])
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
    ).toEqual([
      ['2026-10-29T12:00:00.000Z', 0, 0],
      ['2026-11-01T12:00:00.000Z', 1, 0],
      ['2026-11-04T12:00:00.000Z', 2, 1],
      ['2026-11-05T02:59:59.000Z', 3, 1],
      ['2026-11-05T03:00:00.000Z', 3, 2],
      ['2026-11-05T14:00:00.000Z', 2, 1],
    ])
  })

  it('returns the highest sample of each Sao Paulo day and null for days without samples', async () => {
    await seedSamples()

    const { rows } = await activity('online', 7)
    const byDate = new Map(rows.map((row) => [row.date, row]))

    expect(rows).toHaveLength(7)
    expect(byDate.get('2026-10-30')).toEqual({ date: '2026-10-30', current: null, previous: null })
    expect(byDate.get('2026-11-01')).toEqual({ date: '2026-11-01', current: 1, previous: null })
    // The 02:59:59Z sample (3) is still Nov 4 in Sao Paulo, above the 12:00Z one (2).
    expect(byDate.get('2026-11-04')).toEqual({ date: '2026-11-04', current: 3, previous: null })
    // Nov 5 keeps its 03:00Z peak of 3 though the 14:00Z sample is lower, and pairs with Oct 29's 0.
    expect(byDate.get('2026-11-05')).toEqual({ date: '2026-11-05', current: 3, previous: 0 })

    const open = await activity('open', 7)
    expect(open.rows.filter((row) => row.current !== null)).toEqual([
      { date: '2026-11-01', current: 0, previous: null },
      { date: '2026-11-04', current: 1, previous: null },
      { date: '2026-11-05', current: 2, previous: 0 },
    ])
  })

  it('compares the peak of the period with the one before it in the overview', async () => {
    await seedSamples()

    expect((await overview(7)).metrics).toMatchObject({
      online: { current: 3, previous: 0 },
      open: { current: 2, previous: 0 },
    })
    // No samples at all before Oct 7, so the previous 30 days have no peak.
    expect((await overview(30)).metrics).toMatchObject({
      online: { current: 3, previous: null },
      open: { current: 2, previous: null },
    })
  })

  it('has no peak and only null days before the sampler has run', async () => {
    expect((await overview(7)).metrics).toMatchObject({
      online: { current: null, previous: null },
      open: { current: null, previous: null },
    })
    const { rows } = await activity('online', 7)

    expect(rows).toHaveLength(7)
    expect(rows.every((row) => row.current === null && row.previous === null)).toBe(true)
  })

  it('shows a moderator the same peaks and series', async () => {
    await seedSamples()

    const asModerator = await overview(7, moderator)
    expect(asModerator.metrics).toMatchObject({
      online: { current: 3, previous: 0 },
      open: { current: 2, previous: 0 },
    })
    expect((await activity('online', 7, moderator)).rows.at(-1)).toEqual({
      date: '2026-11-05',
      current: 3,
      previous: 0,
    })
  })
})

describe('who may read the Overview', () => {
  it.each([
    '/api/admin/overview',
    '/api/admin/activity?metric=signups',
    '/api/admin/activity?metric=online',
    '/api/admin/activity?metric=open',
  ])('lets a moderator read %s', async (url) => {
    expect((await get(server, url, moderator)).statusCode).toBe(200)
  })

  it.each(['/api/admin/overview', '/api/admin/activity?metric=signups'])(
    'answers 401 to a signed-out visitor and 403 to a user on %s',
    async (url) => {
      const player = await signIn(server, 'Player')

      expect((await get(server, url)).statusCode).toBe(401)
      const response = await get(server, url, player)
      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
    }
  )

  it.each([
    '/api/admin/overview?period=14',
    '/api/admin/overview?period=abc',
    '/api/admin/activity?metric=signups&period=365',
    '/api/admin/activity?metric=unknown',
    '/api/admin/activity',
  ])('answers 400 to %s', async (url) => {
    expect((await get(server, url, admin)).statusCode).toBe(400)
  })

  it('refuses a bad query only after the guard, so a user still gets 403', async () => {
    const player = await signIn(server, 'Player')

    expect((await get(server, '/api/admin/overview?period=14', player)).statusCode).toBe(403)
  })
})
