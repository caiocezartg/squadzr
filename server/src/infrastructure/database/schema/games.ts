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
  index,
} from 'drizzle-orm/pg-core'
import type { Platform } from '@squadzr/schemas'
import type { GameGenre } from '@domain/entities/game.entity'

// The catalog can be imported from IGDB (CCC-86): `igdbId` is the external
// identity, `genres` and `thumbnailUrl` feed the catalog UI, `popularity`
// orders the listing and `listed` hides rows (legacy rows start delisted)
// while Squads that still reference them keep rendering. `featuredRank` marks
// the hand-picked highlights. `slug` is a display/search handle only: the
// unique identity moved to `igdbId` when the Catalog Import replaced the seed.
export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    igdbId: integer('igdb_id').unique(),
    genres: jsonb('genres')
      .$type<GameGenre[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    platforms: text('platforms')
      .array()
      .$type<Platform[]>()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    // Game Search (#100): `aliases` are the normalized nicknames and acronyms;
    // `searchText` is the normalized name followed by them, joined by " | ". The
    // repository computes both, which is why `searchText` has no default.
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    searchText: text('search_text').notNull(),
    coverUrl: text('cover_url').notNull(),
    thumbnailUrl: text('thumbnail_url').notNull(),
    popularity: integer('popularity').notNull().default(0),
    listed: boolean('listed').notNull().default(true),
    featuredRank: integer('featured_rank'),
    minPlayers: integer('min_players').notNull().default(2),
    maxPlayers: integer('max_players').notNull().default(5),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Trigram index for Game Search's `LIKE '%term%'`; needs the pg_trgm extension.
    searchTextTrgmIdx: index('games_search_text_trgm_idx').using(
      'gin',
      table.searchText.op('gin_trgm_ops')
    ),
  })
)

export type GameRow = typeof games.$inferSelect
export type NewGameRow = typeof games.$inferInsert
