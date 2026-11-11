import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

/** The rows the idempotency key covers; the insert names the same predicate to find the index. */
export function roomReadyOnly(type: AnyPgColumn) {
  return sql`${type} = 'room_ready'`
}

// `room_id` intentionally has no foreign key to `rooms`: a notification is
// history and must survive the room being deleted. The unique index on
// (room_id, user_id, type) is the idempotency key for room-ready notifications
// (CCC-36), and it is partial: the other types are born once, inside the
// transaction that makes the change, and repeat legitimately (two members leave
// the same Squad, so its host is told twice). `room_id` stays nullable so
// notification types without a room can keep their history.
export const userNotifications = pgTable(
  'user_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id'),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    message: text('message').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roomUserTypeUnique: uniqueIndex('user_notifications_room_user_type_unique')
      .on(table.roomId, table.userId, table.type)
      .where(roomReadyOnly(table.type)),
  })
)

export type UserNotificationRow = typeof userNotifications.$inferSelect
export type NewUserNotificationRow = typeof userNotifications.$inferInsert
