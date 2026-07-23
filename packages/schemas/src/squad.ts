import { z } from 'zod'

export const squadLanguageSchema = z.enum(['en', 'pt-br'])

export const membershipRoleSchema = z.enum(['owner', 'member'])

const squadBaseShape = {
  id: z.uuid(),
  code: z.string().length(6),
  name: z.string(),
  gameId: z.uuid(),
  maxMembers: z.number().int().min(2),
  tags: z.array(z.string()),
  language: squadLanguageSchema,
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}

/**
 * This schema is intentionally strict: public callers cannot receive private
 * member fields by accidentally spreading a larger database record.
 */
export const publicRecruitingSquadSchema = z
  .object({
    ...squadBaseShape,
    memberCount: z.number().int().min(0),
  })
  .strict()

export const squadRosterMembershipSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    role: membershipRoleSchema,
    online: z.boolean(),
  })
  .strict()

const memberSquadBaseShape = {
  ...squadBaseShape,
  roster: z.array(squadRosterMembershipSchema),
}

export const memberRecruitingSquadSchema = z
  .object({
    ...memberSquadBaseShape,
    state: z.literal('recruiting'),
  })
  .strict()

export const memberReadySquadSchema = z
  .object({
    ...memberSquadBaseShape,
    state: z.literal('ready'),
    readyAt: z.coerce.date(),
    discordInvitation: z.url(),
  })
  .strict()

export const memberSquadSchema = z.discriminatedUnion('state', [
  memberRecruitingSquadSchema,
  memberReadySquadSchema,
])

export const readyNotificationSchema = z
  .object({
    id: z.uuid(),
    squadId: z.uuid(),
    squadCode: z.string().length(6),
    squadName: z.string(),
    gameName: z.string(),
    discordInvitation: z.url(),
    readAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
  })
  .strict()

export type PublicRecruitingSquadDto = z.infer<typeof publicRecruitingSquadSchema>
export type MemberRecruitingSquadDto = z.infer<typeof memberRecruitingSquadSchema>
export type MemberReadySquadDto = z.infer<typeof memberReadySquadSchema>
export type MemberSquadDto = z.infer<typeof memberSquadSchema>
export type ReadyNotificationDto = z.infer<typeof readyNotificationSchema>
