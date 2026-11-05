import { z } from 'zod'
import { isoDateTimeSchema } from './date'

// One notification type per action. `room_ready` keeps its name from before the other types
// existed; the rest are born in the Squad Release, when a member's other Open Squads are left.
export const userNotificationTypeSchema = z.enum([
  'room_ready',
  'member_left',
  'host_transferred',
  'room_closed',
])

export type UserNotificationTypeDto = z.infer<typeof userNotificationTypeSchema>

// What every type says about its Squad.
const notificationSquadFields = {
  roomId: z.uuid(),
  roomCode: z.string().length(6),
  roomName: z.string(),
  gameName: z.string(),
  // Absent in notifications written before the catalog gained covers (CCC-95).
  gameCoverUrl: z.url().optional(),
}

// A person a notification talks about: shown by name and avatar, never by id.
export const notificationPersonSchema = z.object({ name: z.string(), image: z.string().nullable() })

// A Squad a member left because another one of theirs became Ready.
export const leftSquadSchema = z.object({ roomCode: z.string().length(6), roomName: z.string() })

export type LeftSquadDto = z.infer<typeof leftSquadSchema>

export const roomReadyNotificationPayloadSchema = z.object({
  ...notificationSquadFields,
  players: z.array(notificationPersonSchema),
  // The only type that carries the invite, resolved at read time and never stored.
  discordLink: z.url().nullable(),
  // Absent in notifications written before the Squad Release.
  leftSquads: z.array(leftSquadSchema).optional(),
})

export const hostTransferredNotificationPayloadSchema = z.object({
  ...notificationSquadFields,
  previousHost: notificationPersonSchema,
  reason: z.literal('squad_completed'),
})

export const memberLeftNotificationPayloadSchema = z.object({
  ...notificationSquadFields,
  member: notificationPersonSchema,
  reason: z.literal('squad_completed'),
})

export const roomClosedNotificationPayloadSchema = z.object({
  ...notificationSquadFields,
  previousHost: notificationPersonSchema,
  reason: z.literal('no_eligible_host'),
})

// Any one payload, for code that holds a payload without its notification.
export const userNotificationPayloadSchema = z.union([
  roomReadyNotificationPayloadSchema,
  hostTransferredNotificationPayloadSchema,
  memberLeftNotificationPayloadSchema,
  roomClosedNotificationPayloadSchema,
])

export type UserNotificationPayloadDto = z.infer<typeof userNotificationPayloadSchema>

const notificationBaseFields = {
  id: z.uuid(),
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
}

export const userNotificationSchema = z.discriminatedUnion('type', [
  z.object({
    ...notificationBaseFields,
    type: z.literal('room_ready'),
    payload: roomReadyNotificationPayloadSchema,
  }),
  z.object({
    ...notificationBaseFields,
    type: z.literal('host_transferred'),
    payload: hostTransferredNotificationPayloadSchema,
  }),
  z.object({
    ...notificationBaseFields,
    type: z.literal('member_left'),
    payload: memberLeftNotificationPayloadSchema,
  }),
  z.object({
    ...notificationBaseFields,
    type: z.literal('room_closed'),
    payload: roomClosedNotificationPayloadSchema,
  }),
])

export type UserNotificationDto = z.infer<typeof userNotificationSchema>

export const notificationIdParamSchema = z.object({
  id: z.uuid(),
})

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

// Notification HTTP responses
export const notificationsResponseSchema = z.object({
  notifications: z.array(userNotificationSchema),
})

export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>

// Mark-as-read and delete answer with the same shape.
export const notificationChangeResponseSchema = z.object({ success: z.boolean() })

export const readAllNotificationsResponseSchema = z.object({
  success: z.boolean(),
  count: z.number(),
})
