import { z } from 'zod'
import { isoDateTimeSchema } from './date'
import { pageQuerySchema, paginatedResponseSchema } from './pagination'
import { platformSchema } from './platform'
import { roomLanguageSchema } from './room'

// The reason an admin writes when closing an Open Squad, after the trim. Members read it in the bell and
// the Audit Entry keeps it.
export const ADMIN_CLOSURE_REASON_MIN = 3
export const ADMIN_CLOSURE_REASON_MAX = 280

// The longest search term of the admin Squads list, after the trim. The panel's field is limited to the
// same length.
export const ADMIN_SQUAD_SEARCH_MAX_LENGTH = 100

// Query values arrive as strings: a blank search or an empty game filter means "no filter".
export const adminSquadsQuerySchema = pageQuerySchema.extend({
  q: z
    .string()
    .trim()
    .max(ADMIN_SQUAD_SEARCH_MAX_LENGTH)
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  gameId: z.union([z.literal('').transform(() => undefined), z.uuid()]).optional(),
})

export type AdminSquadsQuery = z.infer<typeof adminSquadsQuerySchema>

export const adminSquadIdParamSchema = z.object({ id: z.uuid() })

// One row of the admin Squads list: an Open Squad, never an email.
export const adminSquadSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  game: z.object({ id: z.uuid(), name: z.string(), coverThumbUrl: z.url() }),
  platform: platformSchema.nullable(),
  host: z.object({ id: z.string(), name: z.string() }),
  memberCount: z.number().int().nonnegative(),
  maxPlayers: z.number().int(),
  createdAt: isoDateTimeSchema,
  lastActivityAt: isoDateTimeSchema,
})

export type AdminSquadDto = z.infer<typeof adminSquadSchema>

export const adminSquadsResponseSchema = paginatedResponseSchema(adminSquadSchema)

export type AdminSquadsResponse = z.infer<typeof adminSquadsResponseSchema>

export const adminSquadMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  isHost: z.boolean(),
  joinedAt: isoDateTimeSchema,
})

export type AdminSquadMemberDto = z.infer<typeof adminSquadMemberSchema>

// The side panel: the list row plus language, the roster (host marked, join times) and the full invite
// an admin judges the Squad by.
export const adminSquadDetailSchema = adminSquadSchema.extend({
  language: roomLanguageSchema,
  discordLink: z.url().nullable(),
  members: z.array(adminSquadMemberSchema),
})

export type AdminSquadDetailDto = z.infer<typeof adminSquadDetailSchema>

export const adminSquadDetailResponseSchema = z.object({ squad: adminSquadDetailSchema })

export type AdminSquadDetailResponse = z.infer<typeof adminSquadDetailResponseSchema>

export const closeSquadInputSchema = z.object({
  reason: z.string().trim().min(ADMIN_CLOSURE_REASON_MIN).max(ADMIN_CLOSURE_REASON_MAX),
})

export type CloseSquadInput = z.infer<typeof closeSquadInputSchema>
