import { z } from 'zod'
import { isoDateTimeSchema } from './date'

// User notification schema
export const userNotificationTypeSchema = z.enum(['room_ready'])

export type UserNotificationTypeDto = z.infer<typeof userNotificationTypeSchema>

export const userNotificationPayloadSchema = z.object({
  roomId: z.uuid(),
  roomCode: z.string().length(6),
  roomName: z.string(),
  gameName: z.string(),
  players: z.array(z.object({ name: z.string(), image: z.string().nullable() })),
  discordLink: z.url().nullable(),
})

export type UserNotificationPayloadDto = z.infer<typeof userNotificationPayloadSchema>

export const userNotificationSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  type: userNotificationTypeSchema,
  title: z.string(),
  message: z.string(),
  payload: userNotificationPayloadSchema,
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
})

export type UserNotificationDto = z.infer<typeof userNotificationSchema>

export const notificationIdParamSchema = z.object({
  id: z.uuid(),
})

export type NotificationIdParamDto = z.infer<typeof notificationIdParamSchema>

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>

// Notification HTTP responses
export const notificationsResponseSchema = z.object({
  notifications: z.array(userNotificationSchema),
})

export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>

// Mark-as-read and delete answer with the same shape.
export const notificationChangeResponseSchema = z.object({ success: z.boolean() })

export type NotificationChangeResponse = z.infer<typeof notificationChangeResponseSchema>

export const readAllNotificationsResponseSchema = z.object({
  success: z.boolean(),
  count: z.number(),
})

export type ReadAllNotificationsResponse = z.infer<typeof readAllNotificationsResponseSchema>
