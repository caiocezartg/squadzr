import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { PLATFORMS } from '@squadzr/schemas'
import { user } from './auth'
import { games } from './games'

// A Squad Record is the immutable account of a Squad that became Ready, written in the
// join transaction that filled it. `room_id` has no foreign key on purpose: the cleanup
// deletes the Squad and the record outlives it, and its unique constraint is the
// idempotency key of the write. A Game is never deleted, so the reference is restrictive.
export const squadRecords = pgTable(
  'squad_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().unique(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 100 }).notNull(),
    platform: text('platform'),
    hostId: text('host_id').references(() => user.id, { onDelete: 'set null' }),
    maxPlayers: integer('max_players').notNull(),
    readyAt: timestamp('ready_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    platformInEnum: check(
      'squad_records_platform_in_enum',
      sql`${table.platform} IS NULL OR ${table.platform} IN (${sql.raw(
        PLATFORMS.map((platform) => `'${platform}'`).join(', ')
      )})`
    ),
  })
)

export const squadRecordMembers = pgTable(
  'squad_record_members',
  {
    recordId: uuid('record_id')
      .notNull()
      .references(() => squadRecords.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.recordId, table.userId] }),
    userIdx: index('squad_record_members_user_idx').on(table.userId),
  })
)

export type SquadRecordRow = typeof squadRecords.$inferSelect
export type NewSquadRecordRow = typeof squadRecords.$inferInsert
export type SquadRecordMemberRow = typeof squadRecordMembers.$inferSelect
