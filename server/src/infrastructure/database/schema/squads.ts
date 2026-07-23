import { sql } from 'drizzle-orm'
import {
  check,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { games } from './games'
import { rooms } from './rooms'

export const squadLifecycleStateEnum = pgEnum('squad_lifecycle_state', ['recruiting', 'ready'])
export const squadMembershipRoleEnum = pgEnum('squad_membership_role', ['owner', 'member'])
export const squadIdempotencyOperationEnum = pgEnum('squad_idempotency_operation', [
  'create',
  'join',
  'leave_current',
])

export const squads = pgTable(
  'squads',
  {
    id: uuid('id').primaryKey(),
    legacyRoomId: uuid('legacy_room_id')
      .unique()
      .references(() => rooms.id, { onDelete: 'set null' }),
    code: varchar('code', { length: 6 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'restrict' }),
    state: squadLifecycleStateEnum('state').notNull(),
    maxMembers: integer('max_members').notNull(),
    discordInvitation: text('discord_invitation').notNull(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    language: varchar('language', { length: 5 }).notNull().default('pt-br'),
    lastMembershipChangeAt: timestamp('last_membership_change_at', {
      withTimezone: true,
    }).notNull(),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    capacityIsAtLeastTwo: check('squads_max_members_at_least_two', sql`${table.maxMembers} >= 2`),
    readyStateHasReadyAt: check(
      'squads_ready_state_has_ready_at',
      sql`(${table.state} <> 'ready' OR ${table.readyAt} IS NOT NULL)`
    ),
    activeDeadline: index('squads_active_deadline_idx').on(table.state, table.expiresAt),
  })
)

export const squadMemberships = pgTable(
  'squad_memberships',
  {
    id: uuid('id').primaryKey(),
    squadId: uuid('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'restrict' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    role: squadMembershipRoleEnum('role').notNull(),
    /** Only populated by the expand migration; it is cleared if the legacy Room ends. */
    legacyRoomId: uuid('legacy_room_id').references(() => rooms.id, { onDelete: 'set null' }),
    /** Remains true after legacy Room deletion so historical overlap is never recast as canonical. */
    isMigratedLegacy: boolean('is_migrated_legacy').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => ({
    squadUserUnique: unique('squad_memberships_squad_user_unique').on(table.squadId, table.userId),
    activeCanonicalMembershipPerUser: uniqueIndex(
      'squad_memberships_one_active_canonical_membership_per_user'
    )
      .on(table.userId)
      .where(sql`${table.endedAt} IS NULL AND ${table.isMigratedLegacy} = false`),
    activeOwnerPerSquad: uniqueIndex('squad_memberships_one_active_owner_per_squad')
      .on(table.squadId)
      .where(sql`${table.role} = 'owner' AND ${table.endedAt} IS NULL`),
  })
)

export const squadIdempotencyReceipts = pgTable(
  'squad_idempotency_receipts',
  {
    id: uuid('id').primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    key: varchar('key', { length: 255 }).notNull(),
    operation: squadIdempotencyOperationEnum('operation').notNull(),
    payloadFingerprint: text('payload_fingerprint').notNull(),
    result: jsonb('result').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorKeyUnique: unique('squad_idempotency_receipts_actor_key_unique').on(
      table.actorId,
      table.key
    ),
  })
)

export const readyNotifications = pgTable(
  'ready_notifications',
  {
    id: uuid('id').primaryKey(),
    squadId: uuid('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'restrict' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    readinessAt: timestamp('readiness_at', { withTimezone: true }).notNull(),
    squadCode: varchar('squad_code', { length: 6 }).notNull(),
    squadName: varchar('squad_name', { length: 100 }).notNull(),
    gameName: varchar('game_name', { length: 100 }).notNull(),
    discordInvitation: text('discord_invitation').notNull(),
    legacyNotificationId: uuid('legacy_notification_id').unique(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    notificationPerReadinessTransition: unique(
      'ready_notifications_squad_user_readiness_unique'
    ).on(table.squadId, table.userId, table.readinessAt),
  })
)

export type SquadRow = typeof squads.$inferSelect
export type SquadMembershipRow = typeof squadMemberships.$inferSelect
export type SquadIdempotencyReceiptRow = typeof squadIdempotencyReceipts.$inferSelect
export type ReadyNotificationRow = typeof readyNotifications.$inferSelect
