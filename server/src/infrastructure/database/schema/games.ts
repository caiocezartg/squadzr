import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'
import type { GameGenre } from '@domain/entities/game.entity'

// The catalog can be imported from IGDB (CCC-86): `igdbId` is the external
// identity, `genres` and `thumbnailUrl` feed the catalog UI, `popularity`
// orders the listing and `listed` hides rows (legacy imports start delisted)
// while Squads that still reference them keep rendering. `featuredRank` marks
// the hand-picked highlights.
export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  igdbId: integer('igdb_id').unique(),
  genres: jsonb('genres')
    .$type<GameGenre[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  coverUrl: text('cover_url').notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  popularity: integer('popularity').notNull().default(0),
  listed: boolean('listed').notNull().default(true),
  featuredRank: integer('featured_rank'),
  minPlayers: integer('min_players').notNull().default(2),
  maxPlayers: integer('max_players').notNull().default(5),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type GameRow = typeof games.$inferSelect
export type NewGameRow = typeof games.$inferInsert
