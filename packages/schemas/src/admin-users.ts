import { z } from 'zod'
import { assignableRoleSchema, userRoleSchema } from './admin'
import { isoDateTimeSchema } from './date'
import { pageQuerySchema, paginatedResponseSchema } from './pagination'
import { profileGameSchema } from './user'

// The admin panel's Users contracts (#118). None of them carries an email: an admin sees what
// support needs (who, when they joined, their role, their Discord id), never how to reach the person.

export const ADMIN_USER_SEARCH_MAX_LENGTH = 100

/** How many completed Squads the user page lists. */
export const ADMIN_USER_LATEST_COMPLETED_LIMIT = 5

// `q` matches a name by any part of it, or a Discord id or a user id exactly; absent or empty it
// lists everyone.
export const adminUsersQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(ADMIN_USER_SEARCH_MAX_LENGTH).optional(),
})

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>

export const adminUserParamsSchema = z.object({ id: z.string().min(1).max(255) })

// The Discord id is the account id of the user's Discord account; null for a user without one.
export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  discordId: z.string().nullable(),
  joinedAt: isoDateTimeSchema,
  role: userRoleSchema,
})

export type AdminUserDto = z.infer<typeof adminUserSchema>

// `openSquads` is how many valid Open Squads the person is a member of (the Squad Limits count).
export const adminUserListItemSchema = adminUserSchema.extend({
  openSquads: z.number().int().nonnegative(),
})

export type AdminUserListItemDto = z.infer<typeof adminUserListItemSchema>

export const adminUsersResponseSchema = paginatedResponseSchema(adminUserListItemSchema)

export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>

const limitUsageSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
})

// An Open Squad the person is in right now; `isHost` marks the ones they host.
export const adminUserSquadSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  game: profileGameSchema,
  memberCount: z.number().int().nonnegative(),
  maxPlayers: z.number().int().positive(),
  isHost: z.boolean(),
})

export type AdminUserSquadDto = z.infer<typeof adminUserSquadSchema>

// A completed Squad, from its Squad Record.
export const adminUserCompletedSquadSchema = z.object({
  id: z.string(),
  name: z.string(),
  game: profileGameSchema,
  maxPlayers: z.number().int().positive(),
  readyAt: isoDateTimeSchema,
})

export type AdminUserCompletedSquadDto = z.infer<typeof adminUserCompletedSquadSchema>

export const adminUserDetailSchema = adminUserSchema.extend({
  online: z.boolean(),
  // Open Squads held (Memberships, the hosted ones included) and hosted, against the Squad Limits.
  squadLimits: z.object({ held: limitUsageSchema, hosted: limitUsageSchema }),
  openSquads: z.array(adminUserSquadSchema),
  completedSquads: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative(),
  latestCompleted: z.array(adminUserCompletedSquadSchema).max(ADMIN_USER_LATEST_COMPLETED_LIMIT),
})

export type AdminUserDetailDto = z.infer<typeof adminUserDetailSchema>

export const adminUserResponseSchema = z.object({ user: adminUserDetailSchema })

export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>

// A role change takes no reason; the confirmation dialog is enough. `owner` is not a role it can
// hand out.
export const changeUserRoleInputSchema = z.object({ role: assignableRoleSchema })

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleInputSchema>

export const changeUserRoleResponseSchema = z.object({ user: adminUserSchema })

export type ChangeUserRoleResponse = z.infer<typeof changeUserRoleResponseSchema>
