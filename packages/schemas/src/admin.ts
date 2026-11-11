import { z } from 'zod'
import { isoDateTimeSchema } from './date'
import { paginatedResponseSchema } from './pagination'

// A person's role. `user` is the default; `moderator`, `admin` and `owner` open the admin panel, each
// with its own reach (see the permission helpers below). `owner` is set only by the terminal script.
// `user` and `admin` match the names the Better Auth admin plugin uses, so the plugin can still be
// added later (with custom roles) without a data migration.
export const USER_ROLES = ['user', 'moderator', 'admin', 'owner'] as const

export const userRoleSchema = z.enum(USER_ROLES)

export type UserRole = z.infer<typeof userRoleSchema>

// The roles a role change can hand out. `owner` is never one of them: it is not reachable through
// the UI or the API.
export const ASSIGNABLE_ROLES = ['user', 'moderator', 'admin'] as const

export const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES)

export type AssignableRole = z.infer<typeof assignableRoleSchema>

// A role as the session carries it: Better Auth types an additional field as a plain string.
type RoleSubject = string | null | undefined

/** Who opens the admin panel: a moderator, an admin or the owner. */
export function canAccessAdminPanel(role: RoleSubject): boolean {
  return role === 'moderator' || role === 'admin' || role === 'owner'
}

/** Who opens the admin-only areas (Audit, role changes, Catalog Import): an admin or the owner. */
export function hasFullAdminAccess(role: RoleSubject): boolean {
  return role === 'admin' || role === 'owner'
}

/**
 * The roles `actor` may give `target`, before the "nobody changes their own role" rule (the caller
 * checks that): the owner changes anyone else; an admin changes only `user` and `moderator` accounts;
 * the owner's role never changes; moderators and users change nothing. Role changes only ever hand
 * out `user`, `moderator` and `admin`.
 */
export function grantableRoles(actor: RoleSubject, target: RoleSubject): readonly AssignableRole[] {
  if (!target || target === 'owner') return []
  if (actor === 'owner') return ASSIGNABLE_ROLES
  if (actor === 'admin' && (target === 'user' || target === 'moderator')) return ASSIGNABLE_ROLES
  return []
}

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
