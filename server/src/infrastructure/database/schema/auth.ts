import { sql } from 'drizzle-orm'
import { boolean, check, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { USER_ROLES, type UserRole } from '@squadzr/schemas'

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    // Declared to Better Auth through `user.additionalFields` with input disabled; the column name and
    // the `user` and `admin` values match the Better Auth admin plugin's, which is not installed
    // (docs/adr/0005). At most one row holds `owner` (the partial unique index below).
    role: text('role').$type<UserRole>().notNull().default('user'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    roleInEnum: check(
      'user_role_in_enum',
      sql`${table.role} IN (${sql.raw(USER_ROLES.map((role) => `'${role}'`).join(', '))})`
    ),
    // At most one owner: every owner row has the same indexed value, so a second one collides.
    singleOwner: uniqueIndex('user_single_owner_idx')
      .on(table.role)
      .where(sql`${table.role} = 'owner'`),
  })
)

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type UserRow = typeof user.$inferSelect
export type NewUserRow = typeof user.$inferInsert
export type SessionRow = typeof session.$inferSelect
export type AccountRow = typeof account.$inferSelect
