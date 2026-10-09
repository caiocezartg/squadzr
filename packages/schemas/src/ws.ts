import { z } from 'zod'
import { playerSchema, publicRoomSchema, roomSchema } from './room'
import { isoDateTimeSchema } from './date'
import { userNotificationSchema } from './notification'

const wsMessageTypeSchema = z.enum([
  'join_room',
  'leave_room',
  'error',
  'ping',
  'pong',
  // Lobby events
  'subscribe_lobby',
  'unsubscribe_lobby',
  'lobby_subscribed',
  'room_created',
  'room_updated',
  'room_deleted',
  // User-targeted notification push
  'notification',
  'protocol',
  'room_snapshot',
  'presence_updated',
  'room_removed',
])

export const REALTIME_PROTOCOL_VERSION = 2
export const WS_MAX_PAYLOAD_BYTES = 16 * 1024

const baseWsMessageSchema = z.object({
  type: wsMessageTypeSchema,
  timestamp: z.number().default(() => Date.now()),
})

// Client only sends roomCode - userId comes from authenticated session
const joinRoomMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('join_room'),
  payload: z.object({
    roomCode: z
      .string()
      .length(6)
      .transform((code) => code.toUpperCase()),
  }),
})

const leaveRoomMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('leave_room'),
  payload: z.object({
    roomCode: z
      .string()
      .length(6)
      .transform((code) => code.toUpperCase()),
  }),
})

export const errorMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('error'),
  payload: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

const pingMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('ping'),
})

const pongMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('pong'),
})

// Lobby subscription messages
const subscribeLobbyMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('subscribe_lobby'),
})

const unsubscribeLobbyMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('unsubscribe_lobby'),
})

const lobbySubscribedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('lobby_subscribed'),
  payload: z.object({
    message: z.string(),
  }),
})

// Catalog event pushed to every lobby subscriber, guests included: public projection only.
export const roomCreatedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('room_created'),
  payload: z.object({
    room: publicRoomSchema,
  }),
})

const roomUpdatedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('room_updated'),
  payload: z.object({
    roomId: z.uuid(),
    roomCode: z.string().length(6),
    memberCount: z.number().int().min(0),
  }),
})

const roomDeletedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('room_deleted'),
  payload: z.object({
    roomId: z.uuid(),
    roomCode: z.string(),
  }),
})

// User-targeted push: only sent to sockets authenticated as `payload.notification.userId`.
const notificationMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('notification'),
  payload: z.object({
    notification: userNotificationSchema,
  }),
})

export const protocolMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('protocol'),
  payload: z.object({ version: z.literal(REALTIME_PROTOCOL_VERSION) }),
})

// Version-agnostic announcement: a client parses it before the version-specific
// contract so a mismatched build can be detected and reloaded instead of being
// rejected as an invalid payload.
export const protocolAnnouncementSchema = z.object({
  version: z.number().int().positive(),
})

const memberPresenceSchema = z.object({ playerId: z.string(), online: z.boolean() })

// Replaces the live roster in its entirety; applying it twice has the same effect.
export const roomSnapshotMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('room_snapshot'),
  payload: z.object({
    room: roomSchema,
    players: z.array(playerSchema),
    readyAt: isoDateTimeSchema.nullable(),
    expiresAt: isoDateTimeSchema,
    presence: z.array(memberPresenceSchema),
  }),
})

// Presence assigns a boolean; it never adds or removes a Membership.
const presenceUpdatedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('presence_updated'),
  payload: memberPresenceSchema.extend({ roomCode: z.string().length(6) }),
})

// Catalog-only hint, including Ready Rooms that retain their member channel.
const roomRemovedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('room_removed'),
  payload: z.object({ roomId: z.uuid(), roomCode: z.string().length(6) }),
})

export const wsIncomingMessageSchema = z.discriminatedUnion('type', [
  joinRoomMessageSchema,
  leaveRoomMessageSchema,
  pingMessageSchema,
  subscribeLobbyMessageSchema,
  unsubscribeLobbyMessageSchema,
])

export const wsServerMessageSchema = z.discriminatedUnion('type', [
  errorMessageSchema,
  pongMessageSchema,
  lobbySubscribedMessageSchema,
  roomCreatedMessageSchema,
  roomUpdatedMessageSchema,
  roomDeletedMessageSchema,
  notificationMessageSchema,
  protocolMessageSchema,
  roomSnapshotMessageSchema,
  presenceUpdatedMessageSchema,
  roomRemovedMessageSchema,
])

// Frame envelope every server message shares, before its payload is checked per event
export const wsServerEnvelopeSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
})

// Payload-only schemas (for client-side validation of incoming WS events)
const errorPayloadSchema = errorMessageSchema.shape.payload
const roomCreatedPayloadSchema = roomCreatedMessageSchema.shape.payload
const roomUpdatedPayloadSchema = roomUpdatedMessageSchema.shape.payload
const roomDeletedPayloadSchema = roomDeletedMessageSchema.shape.payload
const notificationPayloadSchema = notificationMessageSchema.shape.payload
const lobbySubscribedPayloadSchema = lobbySubscribedMessageSchema.shape.payload

// Payload schema of each server event that carries one, keyed by message type
export const wsServerEventPayloadSchemas = {
  error: errorPayloadSchema,
  lobby_subscribed: lobbySubscribedPayloadSchema,
  room_created: roomCreatedPayloadSchema,
  room_updated: roomUpdatedPayloadSchema,
  room_deleted: roomDeletedPayloadSchema,
  notification: notificationPayloadSchema,
  protocol: protocolMessageSchema.shape.payload,
  room_snapshot: roomSnapshotMessageSchema.shape.payload,
  presence_updated: presenceUpdatedMessageSchema.shape.payload,
  room_removed: roomRemovedMessageSchema.shape.payload,
} as const

export type WsServerEventType = keyof typeof wsServerEventPayloadSchemas
export type WsServerEventPayload<T extends WsServerEventType> = z.infer<
  (typeof wsServerEventPayloadSchemas)[T]
>

// Inferred types
export type WsIncomingMessage = z.infer<typeof wsIncomingMessageSchema>
/** Frame as callers build it, before defaults and transforms are applied. */
export type WsIncomingMessageInput = z.input<typeof wsIncomingMessageSchema>
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>
export type JoinRoomMessage = z.infer<typeof joinRoomMessageSchema>
export type LeaveRoomMessage = z.infer<typeof leaveRoomMessageSchema>
