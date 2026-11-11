import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditDetails,
  type AuditTarget,
} from '@squadzr/schemas'
import { user } from './auth'

// An Audit Entry is the append-only account of one admin action. The actor keeps a name snapshot and
// loses only the reference when their account is deleted; the target is a snapshot too, so the entry
// reads the same after the Squad or the person is gone. Nothing updates or deletes an entry.
export const auditEntries = pgTable(
  'audit_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    actorName: text('actor_name'),
    action: varchar('action', { length: 50 }).$type<AuditAction>().notNull(),
    target: jsonb('target').$type<AuditTarget>(),
    reason: text('reason'),
    details: jsonb('details').$type<AuditDetails>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionInEnum: check(
      'audit_entries_action_in_enum',
      sql`${table.action} IN (${sql.raw(AUDIT_ACTIONS.map((action) => `'${action}'`).join(', '))})`
    ),
    createdAtIdx: index('audit_entries_created_at_idx').on(table.createdAt.desc(), table.id.desc()),
  })
)

export type AuditEntryRow = typeof auditEntries.$inferSelect
export type NewAuditEntryRow = typeof auditEntries.$inferInsert
