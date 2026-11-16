import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { CHAT } from '@squadzr/schemas'
import { user } from './auth'
import { rooms } from './rooms'

// A Chat Message lives as long as its Squad: deleting the room deletes the history, unlike a
// Squad Record. `id` is supplied by the client and is the idempotency key of a send.
// `created_at` has no default on purpose: the repository writes the instant of the app clock,
// so the order, the cursor and the rate rule share one clock, at the millisecond precision a
// JavaScript `Date` round-trips.
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull(),
  },
  (table) => ({
    bodyLength: check(
      'chat_messages_body_length',
      sql`char_length(${table.body}) BETWEEN 1 AND ${sql.raw(String(CHAT.MESSAGE_MAX_LENGTH))}`
    ),
    roomHistoryIdx: index('chat_messages_room_history_idx').on(
      table.roomId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    roomAuthorIdx: index('chat_messages_room_author_idx').on(
      table.roomId,
      table.authorId,
      table.createdAt.desc()
    ),
  })
)

export type ChatMessageRow = typeof chatMessages.$inferSelect
export type NewChatMessageRow = typeof chatMessages.$inferInsert
