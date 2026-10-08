/**
 * The WebSocket transport seam: `onServerEvent` only hands a handler a payload that
 * parsed against its contract from @squadzr/schemas. The socket is the deterministic
 * `MockWebSocket` (src/test/setup.ts).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketClient } from './ws-client'
import { onServerEvent, parseServerEvent } from './ws-validators'
import { latestWebSocket } from '@/test/ws-mock'
import { hostPlayer, openRoom } from '@/test/fixtures'

const SECRET_INVITE = 'https://discord.gg/secret-invite'

function connectedClient() {
  const client = new WebSocketClient({ url: 'ws://squadzr.test/ws' })
  client.connect()
  latestWebSocket().open()
  return { client, on: client.on.bind(client), socket: latestWebSocket() }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('onServerEvent', () => {
  it('hands the handler the validated payload of a valid message', () => {
    const { on, socket } = connectedClient()
    const handler = vi.fn()
    onServerEvent(on, 'room_updated', handler)

    socket.serverSend({
      type: 'room_updated',
      payload: { roomId: openRoom.id, roomCode: openRoom.code, memberCount: 3 },
    })

    expect(handler.mock.calls).toEqual([
      [{ roomId: openRoom.id, roomCode: openRoom.code, memberCount: 3 }],
    ])
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([
    ['room_updated', { roomId: openRoom.id, roomCode: openRoom.code, memberCount: -1 }],
    ['room_created', { room: { ...openRoom, createdAt: 1_769_000_000 } }],
    [
      'room_snapshot',
      {
        room: openRoom,
        players: [{ id: 'user-1' }],
        readyAt: null,
        expiresAt: openRoom.updatedAt,
        presence: [],
      },
    ],
    ['room_removed', {}],
    ['error', { code: 500 }],
  ] as const)('drops an invalid %s payload before it reaches the handler', (type, payload) => {
    const { on, socket } = connectedClient()
    const handler = vi.fn()
    onServerEvent(on, type, handler)

    socket.serverSend({ type, payload })

    expect(handler).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket payload:', {
      type,
      issues: expect.arrayContaining([{ path: expect.any(String), code: expect.any(String) }]),
    })
  })

  it('strips the invite from a guest catalog event', () => {
    const { on, socket } = connectedClient()
    const handler = vi.fn()
    onServerEvent(on, 'room_created', handler)

    socket.serverSend({
      type: 'room_created',
      payload: { room: { ...openRoom, discordLink: SECRET_INVITE } },
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(handler.mock.calls)).not.toContain(SECRET_INVITE)
  })

  it('stops delivering after unsubscribe', () => {
    const { on, socket } = connectedClient()
    const handler = vi.fn()
    const unsubscribe = onServerEvent(on, 'presence_updated', handler)

    unsubscribe()
    socket.serverSend({
      type: 'presence_updated',
      payload: { roomCode: openRoom.code, playerId: 'user-2', online: true },
    })

    expect(handler).not.toHaveBeenCalled()
  })
})

describe('diagnostics', () => {
  it.each([
    [
      'truncated JSON',
      `{"type":"room_created","payload":{"discordLink":"${SECRET_INVITE}","sessionToken":"session-secret`,
    ],
    ['text that is not JSON', `discordLink=${SECRET_INVITE} sessionToken=session-secret`],
  ])('reports %s by code without logging the frame', (_label, frame) => {
    const { client, socket } = connectedClient()
    const handler = vi.fn()
    client.on('room_created', handler)

    socket.onmessage?.(new MessageEvent('message', { data: frame }))

    expect(handler).not.toHaveBeenCalled()
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ['Invalid WebSocket message:', { issues: [{ path: '', code: 'invalid_json' }] }],
      ['Realtime protocol failure:', { reason: 'unparseable_frame', expectedVersion: 2 }],
    ])
    // A frame that cannot be parsed is a protocol failure: the connection
    // closes so the app can reload into the matching build.
    expect(client.status).toBe('closed')
  })

  it('reports a throwing handler by event type only and keeps the connection', () => {
    const { client, socket } = connectedClient()
    client.on('presence_updated', () => {
      throw new Error(`cannot handle ${SECRET_INVITE}`)
    })

    socket.serverSend({
      type: 'presence_updated',
      payload: { roomCode: openRoom.code, playerId: SECRET_INVITE, online: true },
    })

    expect(vi.mocked(console.error).mock.calls).toEqual([
      ['WebSocket handler failed:', { type: 'presence_updated' }],
    ])
    expect(client.isConnected).toBe(true)
  })

  it('reports issue paths and codes without any payload content', () => {
    const payload = {
      room: { ...openRoom, discordLink: SECRET_INVITE },
      players: [{ ...hostPlayer, name: 42, sessionToken: 'session-secret' }],
      readyAt: null,
      expiresAt: openRoom.updatedAt,
      presence: [],
    }

    expect(parseServerEvent('room_snapshot', payload)).toBeNull()

    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket payload:', {
      type: 'room_snapshot',
      issues: [{ path: 'players.0.name', code: 'invalid_type' }],
    })
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logged).not.toContain(SECRET_INVITE)
    expect(logged).not.toContain('session-secret')
  })

  it('drops a frame without a string type before any handler runs', () => {
    const { client, socket } = connectedClient()
    const handler = vi.fn()
    client.on('room_created', handler)

    socket.onmessage?.(
      new MessageEvent('message', { data: JSON.stringify({ payload: { room: SECRET_INVITE } }) })
    )
    socket.onmessage?.(new MessageEvent('message', { data: '42' }))

    expect(handler).not.toHaveBeenCalled()
    // The first frame is already a protocol failure, so it closes the
    // connection; the second never reaches the parser.
    expect(console.error).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket message:', {
      issues: [{ path: 'type', code: 'invalid_type' }],
    })
    expect(console.error).toHaveBeenCalledWith('Realtime protocol failure:', {
      reason: 'unparseable_frame',
      expectedVersion: 2,
    })
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(SECRET_INVITE)
  })
})
