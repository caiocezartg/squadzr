import { z } from 'zod'
import { isoDateTimeSchema } from './date'
import { paginatedResponseSchema } from './pagination'

// A person's role. `user` is the default; `admin` opens the admin panel. The names match the ones
// the Better Auth admin plugin uses, so the plugin can still be added later without a data migration.
export const USER_ROLES = ['user', 'admin'] as const

export const userRoleSchema = z.enum(USER_ROLES)

export type UserRole = z.infer<typeof userRoleSchema>

// What an admin did. An Audit Entry is append-only and carries one of these.
export const AUDIT_ACTIONS = [
  'role_changed',
  'squad_closed',
  'catalog_import_requested',
  'admin_granted',
] as const

export const auditActionSchema = z.enum(AUDIT_ACTIONS)

export type AuditAction = z.infer<typeof auditActionSchema>

// A snapshot of what the action touched, so the entry stays readable after the Squad or the person
// is gone.
export const auditTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user'), id: z.string(), name: z.string() }),
  z.object({
    type: z.literal('squad'),
    id: z.string(),
    name: z.string(),
    code: z.string(),
    game: z.string(),
  }),
])

export type AuditTarget = z.infer<typeof auditTargetSchema>

// What changed: the old and new role of a role change or grant, or the Catalog Import Run requested.
export const auditDetailsSchema = z.union([
  z.object({ oldRole: userRoleSchema, newRole: userRoleSchema }),
  z.object({ runId: z.string() }),
])

export type AuditDetails = z.infer<typeof auditDetailsSchema>

// `actorId` is null once the admin's account is gone and `actorName` is null for an action nobody
// took through the panel (the grant script); the panel shows "System" for the latter.
export const auditEntrySchema = z.object({
  id: z.string(),
  action: auditActionSchema,
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  target: auditTargetSchema.nullable(),
  reason: z.string().nullable(),
  details: auditDetailsSchema.nullable(),
  createdAt: isoDateTimeSchema,
})

export type AuditEntryDto = z.infer<typeof auditEntrySchema>

export const auditEntriesResponseSchema = paginatedResponseSchema(auditEntrySchema)

export type AuditEntriesResponse = z.infer<typeof auditEntriesResponseSchema>
