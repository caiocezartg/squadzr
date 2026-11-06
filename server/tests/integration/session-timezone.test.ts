import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import { sql } from 'drizzle-orm'
import pg from 'pg'
import { createDatabase, type DatabaseConnection } from '@infrastructure/database/drizzle'
import { user } from '@infrastructure/database/schema'
import { DrizzleAdminStatsRepository } from '@infrastructure/repositories/drizzle-admin-stats.repository'
import {
  createIsolatedDatabase,
  type IsolatedDatabase,
  type PostgresHarnessContext,
} from '@test/harness/postgres'

// #126 review: `user.created_at` is a `timestamp` without a zone read as UTC by the admin stats, so
// the pool pins every connection to UTC. A database whose default zone is Sao Paulo must not shift
// the sign-up day of a row that took the column's `now()` default.

const { Client } = pg
const TIME_ZONE = 'America/Sao_Paulo'

let context: PostgresHarnessContext
let database: IsolatedDatabase
let connection: DatabaseConnection

beforeEach(async () => {
  context = inject('postgres')
  database = await createIsolatedDatabase(context)
  const admin = new Client({ connectionString: context.adminUrl })
  await admin.connect()
  try {
    await admin.query(`ALTER DATABASE "${database.name}" SET timezone = '${TIME_ZONE}'`)
  } finally {
    await admin.end()
  }
  connection = createDatabase(database.url)
})

afterEach(async () => {
  await connection.close()
  await database.drop()
})

describe('pooled connections', () => {
  it('run in UTC although the database defaults to another zone', async () => {
    const plain = new Client({ connectionString: database.url })
    await plain.connect()
    const unpinned = await plain.query<{ zone: string }>(
      `select current_setting('timezone') as zone`
    )
    await plain.end()

    const pinned = await connection.db.execute<{ zone: string }>(
      sql`select current_setting('timezone') as zone`
    )

    expect(unpinned.rows[0]?.zone).toBe(TIME_ZONE)
    expect(pinned.rows[0]?.zone).toBe('UTC')
  })

  it('keep the sign-up day of a default created_at in the panel zone', async () => {
    const before = Date.now()
    await connection.db
      .insert(user)
      .values({ id: 'tz-user', name: 'Tz', email: 'tz@example.com', emailVerified: true })
    const after = Date.now()

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(after))
    const startDay = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(
      new Date(before)
    )
    const counts = await new DrizzleAdminStatsRepository(connection.db).countByDay(
      'signups',
      startDay,
      today,
      TIME_ZONE
    )

    expect([...counts.values()].reduce((sum, total) => sum + total, 0)).toBe(1)
    expect(counts.get(today) ?? counts.get(startDay)).toBe(1)

    // The stored wall clock is the UTC one, not the database's Sao Paulo one.
    const { rows } = await connection.db.execute<{ drift: number }>(
      sql`select abs(extract(epoch from ("created_at" - (now() at time zone 'UTC'))))::float as drift from "user"`
    )
    expect(Number(rows[0]?.drift)).toBeLessThan(60)
  })
})
