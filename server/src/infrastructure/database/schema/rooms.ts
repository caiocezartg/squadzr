import { sql } from 'drizzle-orm'
import { pgTable, uuid, varchar, timestamp, integer, text, check } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { games } from './games'

// The room lifecycle is timestamp-driven (ADR-0001): an Open Room has a null
// `readyAt`, a Ready Room has it set, and `lastActivityAt` feeds the Open Room
// expiration rule. There is no status column and no PostgreSQL enum.
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 6 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    hostId: text('host_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'restrict' }),
    maxPlayers: integer('max_players').notNull().default(5),
    discordLink: text('discord_link'),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    language: varchar('language', { length: 5 }).notNull().default('pt-br'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Explicit lifecycle invariants. Readiness and membership activity can
    // never predate the room; readiness is produced by the membership change
    // that fills the room, so it can never predate the last activity either.
    readyAfterCreated: check(
      'rooms_ready_after_created',
      sql`${table.readyAt} IS NULL OR ${table.readyAt} >= ${table.createdAt}`
    ),
    lastActivityAfterCreated: check(
      'rooms_last_activity_after_created',
      sql`${table.lastActivityAt} >= ${table.createdAt}`
    ),
    readyAfterLastActivity: check(
      'rooms_ready_after_last_activity',
      sql`${table.readyAt} IS NULL OR ${table.readyAt} >= ${table.lastActivityAt}`
    ),
  })
)

export type RoomRow = typeof rooms.$inferSelect
export type NewRoomRow = typeof rooms.$inferInsert
