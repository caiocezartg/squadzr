import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

// An Activity Sample is one reading taken by the sampler every few minutes: how many people were
// online and how many Squads open at that instant. Samples are kept indefinitely; the admin Overview
// reads the highest of each day.
export const activitySamples = pgTable(
  'activity_samples',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sampledAt: timestamp('sampled_at', { withTimezone: true }).notNull(),
    onlineUsers: integer('online_users').notNull(),
    openSquads: integer('open_squads').notNull(),
  },
  (table) => ({
    countsNotNegative: check(
      'activity_samples_counts_not_negative',
      sql`${table.onlineUsers} >= 0 AND ${table.openSquads} >= 0`
    ),
    sampledAtIdx: index('activity_samples_sampled_at_idx').on(table.sampledAt),
  })
)

export type ActivitySampleRow = typeof activitySamples.$inferSelect
export type NewActivitySampleRow = typeof activitySamples.$inferInsert
