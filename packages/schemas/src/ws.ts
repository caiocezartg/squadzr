import { z } from 'zod'
import { playerSchema, publicRoomSchema, roomSchema } from './room'
import { isoDateTimeSchema } from './date'
import { userNotificationSchema } from './notification'

export const wsMessageTypeSchema = z.enum([
  'join_room',
  'leave_room',
  'room_joined',
  'room_left',
  'player_joined',
  'player_left',
  'viewer_left',
  'room_ready',
  'game_start',
  'game_end',
  'game_state',
  'player_action',
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

export type WsMessageType = z.infer<typeof wsMessageTypeSchema>

export const baseWsMessageSchema = z.object({
  type: wsMessageTypeSchema,
  timestamp: z.number().default(() => Date.now()),
})

// Shared player schema for WS payloads
export const wsPlayerSchema = playerSchema

// Client only sends roomCode - userId comes from authenticated session
export const joinRoomMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('join_room'),
  payload: z.object({
    roomCode: z
      .string()
      .length(6)
      .transform((code) => code.toUpperCase()),
  }),
})

export const leaveRoomMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('leave_room'),
  payload: z.object({
    roomCode: z
      .string()
      .length(6)
      .transform((code) => code.toUpperCase()),
  }),
})

export const roomJoinedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('room_joined'),
  payload: z.object({
    roomId: z.uuid(),
    roomCode: z.string().length(6),
    players: z.array(wsPlayerSchema),
  }),
})

export const playerJoinedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('player_joined'),
  payload: z.object({
    player: wsPlayerSchema,
  }),
})

export const playerLeftMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('player_left'),
  payload: z.object({
    playerId: z.string(),
  }),
})

export const viewerLeftMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('viewer_left'),
  payload: z.object({
    playerId: z.string(),
    roomCode: z.string().length(6),
  }),
})

export const roomReadyMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('room_ready'),
  payload: z.object({
    roomId: z.uuid(),
    roomCode: z.string().length(6),
    message: z.string(),
  }),
})

export const errorMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('error'),
  payload: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export const pingMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('ping'),
})

export const pongMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('pong'),
})

// Lobby subscription messages
export const subscribeLobbyMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('subscribe_lobby'),
})

export const unsubscribeLobbyMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('unsubscribe_lobby'),
})

export const lobbySubscribedMessageSchema = baseWsMessageSchema.extend({
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

export const roomUpdatedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('room_updated'),
  payload: z.object({
    roomId: z.uuid(),
    roomCode: z.string().length(6),
    memberCount: z.number().int().min(0),
  }),
})

export const roomDeletedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('room_deleted'),
  payload: z.object({
    roomId: z.uuid(),
    roomCode: z.string(),
  }),
})

// User-targeted push: only sent to sockets authenticated as `payload.notification.userId`.
export const notificationMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('notification'),
  payload: z.object({
    notification: userNotificationSchema,
  }),
})

export const protocolMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('protocol'),
  payload: z.object({ version: z.literal(REALTIME_PROTOCOL_VERSION) }),
})

export const memberPresenceSchema = z.object({ playerId: z.string(), online: z.boolean() })

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
export const presenceUpdatedMessageSchema = baseWsMessageSchema.extend({
  type: z.literal('presence_updated'),
  payload: memberPresenceSchema.extend({ roomCode: z.string().length(6) }),
})

// Catalog-only hint, including Ready Rooms that retain their member channel.
export const roomRemovedMessageSchema = baseWsMessageSchema.extend({
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
  roomJoinedMessageSchema,
  playerJoinedMessageSchema,
  playerLeftMessageSchema,
  viewerLeftMessageSchema,
  roomReadyMessageSchema,
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
export const roomJoinedPayloadSchema = roomJoinedMessageSchema.shape.payload
export const playerJoinedPayloadSchema = playerJoinedMessageSchema.shape.payload
export const playerLeftPayloadSchema = playerLeftMessageSchema.shape.payload
export const viewerLeftPayloadSchema = viewerLeftMessageSchema.shape.payload
export const roomReadyPayloadSchema = roomReadyMessageSchema.shape.payload
export const errorPayloadSchema = errorMessageSchema.shape.payload
export const roomCreatedPayloadSchema = roomCreatedMessageSchema.shape.payload
export const roomUpdatedPayloadSchema = roomUpdatedMessageSchema.shape.payload
export const roomDeletedPayloadSchema = roomDeletedMessageSchema.shape.payload
export const notificationPayloadSchema = notificationMessageSchema.shape.payload
export const lobbySubscribedPayloadSchema = lobbySubscribedMessageSchema.shape.payload

// Payload schema of each server event that carries one, keyed by message type
export const wsServerEventPayloadSchemas = {
  room_joined: roomJoinedPayloadSchema,
  player_joined: playerJoinedPayloadSchema,
  player_left: playerLeftPayloadSchema,
  viewer_left: viewerLeftPayloadSchema,
  room_ready: roomReadyPayloadSchema,
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
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>
export type WsServerEnvelope = z.infer<typeof wsServerEnvelopeSchema>
export type JoinRoomMessage = z.infer<typeof joinRoomMessageSchema>
export type LeaveRoomMessage = z.infer<typeof leaveRoomMessageSchema>
export type RoomJoinedMessage = z.infer<typeof roomJoinedMessageSchema>
export type PlayerJoinedMessage = z.infer<typeof playerJoinedMessageSchema>
export type PlayerLeftMessage = z.infer<typeof playerLeftMessageSchema>
export type ViewerLeftMessage = z.infer<typeof viewerLeftMessageSchema>
export type RoomReadyMessage = z.infer<typeof roomReadyMessageSchema>
export type ErrorMessage = z.infer<typeof errorMessageSchema>
export type PingMessage = z.infer<typeof pingMessageSchema>
export type PongMessage = z.infer<typeof pongMessageSchema>
export type SubscribeLobbyMessage = z.infer<typeof subscribeLobbyMessageSchema>
export type UnsubscribeLobbyMessage = z.infer<typeof unsubscribeLobbyMessageSchema>
export type LobbySubscribedMessage = z.infer<typeof lobbySubscribedMessageSchema>
export type RoomCreatedMessage = z.infer<typeof roomCreatedMessageSchema>
export type RoomUpdatedMessage = z.infer<typeof roomUpdatedMessageSchema>
export type RoomDeletedMessage = z.infer<typeof roomDeletedMessageSchema>
export type NotificationMessage = z.infer<typeof notificationMessageSchema>
export type RoomSnapshotMessage = z.infer<typeof roomSnapshotMessageSchema>
export type PresenceUpdatedMessage = z.infer<typeof presenceUpdatedMessageSchema>
export type RoomRemovedMessage = z.infer<typeof roomRemovedMessageSchema>
