import { describe, expect, expectTypeOf, it } from 'vitest'
import type { PlayerDto, PublicRoomDto } from './index'
import {
  protocolAnnouncementSchema,
  roomCreatedMessageSchema,
  wsIncomingMessageSchema,
  wsServerEnvelopeSchema,
  wsServerEventPayloadSchemas,
  wsServerMessageSchema,
} from './ws'
import type { WsServerEventPayload, WsServerMessage } from './ws'

const ROOM_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const INVITE = 'https://discord.gg/squadzr'

const publicRoom = {
  id: ROOM_ID,
  code: 'ABC123',
  name: 'Ranked 5v5',
  hostId: 'user-1',
  gameId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  maxPlayers: 5,
  tags: [],
  language: 'en',
  createdAt: '2026-09-27T12:30:00.000Z',
  updatedAt: '2026-09-27T12:30:00.000Z',
}
const player = { id: 'user-1', name: 'Caio', image: null, isHost: true }

const notification = {
  id: '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6b',
  userId: 'user-1',
  type: 'room_ready',
  title: 'Room ready: your squad is full',
  message: 'Ranked 5v5 is ready. Your Discord invite is now available.',
  payload: {
    roomId: ROOM_ID,
    roomCode: 'ABC123',
    roomName: 'Ranked 5v5',
    gameName: 'League of Legends',
    players: [{ name: 'Caio', image: null }],
    discordLink: INVITE,
  },
  readAt: null,
  createdAt: '2026-09-27T12:30:00.000Z',
}

const serverMessages = [
  { type: 'protocol', payload: { version: 2 } },
  {
    type: 'room_snapshot',
    payload: {
      room: { ...publicRoom, discordLink: INVITE },
      players: [player],
      readyAt: null,
      expiresAt: publicRoom.updatedAt,
      presence: [{ playerId: player.id, online: true }],
    },
  },
  { type: 'presence_updated', payload: { roomCode: 'ABC123', playerId: player.id, online: false } },
  { type: 'room_removed', payload: { roomId: ROOM_ID, roomCode: 'ABC123' } },
  { type: 'error', payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } },
  { type: 'pong' },
  { type: 'lobby_subscribed', payload: { message: 'Subscribed' } },
  { type: 'room_created', payload: { room: publicRoom } },
  { type: 'room_updated', payload: { roomId: ROOM_ID, roomCode: 'ABC123', memberCount: 2 } },
  { type: 'room_deleted', payload: { roomId: ROOM_ID, roomCode: 'ABC123' } },
  { type: 'notification', payload: { notification } },
].map((message) => ({ ...message, timestamp: 1_769_000_000_000 }))

describe('wsIncomingMessageSchema', () => {
  it.each([
    [{ type: 'join_room', payload: { roomCode: 'ABC123' } }],
    [{ type: 'leave_room', payload: { roomCode: 'ABC123' } }],
    [{ type: 'subscribe_lobby' }],
    [{ type: 'unsubscribe_lobby' }],
    [{ type: 'ping' }],
  ])('accepts %j and stamps it with a timestamp', (message) => {
    const parsed = wsIncomingMessageSchema.parse(message)

    expect(parsed).toMatchObject(message)
    expect(parsed.timestamp).toEqual(expect.any(Number))
  })

  it.each([
    ['a retired server type', { type: 'room_joined', payload: {} }],
    ['an unknown type', { type: 'game_start' }],
    ['a missing payload', { type: 'join_room' }],
    ['a room code with the wrong length', { type: 'join_room', payload: { roomCode: 'ABC' } }],
    ['a value that is not an object', 42],
  ])('rejects %s', (_label, message) => {
    expect(wsIncomingMessageSchema.safeParse(message).success).toBe(false)
  })
})

describe('wsServerMessageSchema', () => {
  it.each(serverMessages.map((message) => [message.type, message] as const))(
    'accepts a %s message',
    (_type, message) => {
      expect(wsServerMessageSchema.parse(message)).toEqual(message)
    }
  )

  it.each([
    ['a client-only type', { type: 'join_room', payload: { roomCode: 'ABC123' } }],
    ['an unknown type', { type: 'presence_changed', payload: {} }],
    ['a payload that breaks its event contract', { type: 'room_updated', payload: { n: 1 } }],
    [
      'a roster entry without a name',
      {
        type: 'room_snapshot',
        payload: {
          room: { ...publicRoom, discordLink: INVITE },
          players: [{ id: 'u' }],
          readyAt: null,
          expiresAt: publicRoom.updatedAt,
          presence: [],
        },
      },
    ],
  ])('rejects %s', (_label, message) => {
    expect(wsServerMessageSchema.safeParse({ ...message, timestamp: 0 }).success).toBe(false)
  })

  it('discriminates the payload type by message type', () => {
    type Created = Extract<WsServerMessage, { type: 'room_created' }>
    type Snapshot = Extract<WsServerMessage, { type: 'room_snapshot' }>

    expectTypeOf<Created['payload']['room']>().toEqualTypeOf<PublicRoomDto>()
    expectTypeOf<Snapshot['payload']['players']>().toEqualTypeOf<PlayerDto[]>()
    expectTypeOf<WsServerEventPayload<'room_created'>>().toEqualTypeOf<Created['payload']>()
  })
})

describe('room_created', () => {
  it('carries the public projection only: an invite on the wire is dropped', () => {
    const parsed = roomCreatedMessageSchema.parse({
      type: 'room_created',
      timestamp: 0,
      payload: { room: { ...publicRoom, discordLink: INVITE } },
    })

    expect(parsed.payload.room).toEqual(publicRoom)
    expect(JSON.stringify(parsed)).not.toContain(INVITE)
    expectTypeOf(parsed.payload.room).not.toHaveProperty('discordLink')
  })
})

describe('wsServerEventPayloadSchemas', () => {
  it('has one payload schema for every server message that carries a payload', () => {
    const typesWithPayload = serverMessages
      .filter((message) => 'payload' in message)
      .map((message) => message.type)

    expect(Object.keys(wsServerEventPayloadSchemas).sort()).toEqual(typesWithPayload.sort())
  })

  it('validates each payload on its own, as the client receives it', () => {
    for (const message of serverMessages) {
      if (!('payload' in message)) continue
      const schema =
        wsServerEventPayloadSchemas[message.type as keyof typeof wsServerEventPayloadSchemas]

      expect(schema.safeParse(message.payload).success, message.type).toBe(true)
      expect(schema.safeParse({}).success, message.type).toBe(false)
    }
  })
})

describe('wsServerEnvelopeSchema', () => {
  it('requires a string type and leaves the payload for the per-event contract', () => {
    expect(wsServerEnvelopeSchema.parse({ type: 'pong', timestamp: 1 })).toEqual({ type: 'pong' })
    expect(wsServerEnvelopeSchema.parse({ type: 'x', payload: { n: 1 } })).toEqual({
      type: 'x',
      payload: { n: 1 },
    })
    expect(wsServerEnvelopeSchema.safeParse({ payload: {} }).success).toBe(false)
    expect(wsServerEnvelopeSchema.safeParse(42).success).toBe(false)
  })
})

describe('protocolAnnouncementSchema', () => {
  it('accepts any positive version so a mismatched build can react before its own contract', () => {
    expect(protocolAnnouncementSchema.parse({ version: 2 })).toEqual({ version: 2 })
    expect(protocolAnnouncementSchema.parse({ version: 3 })).toEqual({ version: 3 })
  })

  it.each([
    ['a non-numeric version', { version: 'two' }],
    ['a fractional version', { version: 2.5 }],
    ['a missing version', {}],
  ])('rejects %s', (_label, payload) => {
    expect(protocolAnnouncementSchema.safeParse(payload).success).toBe(false)
  })
})
