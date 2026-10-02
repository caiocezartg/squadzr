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
    ['room_joined', { roomId: openRoom.id, roomCode: 'ABC123', players: [{ id: 'user-1' }] }],
    ['room_ready', {}],
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
    const unsubscribe = onServerEvent(on, 'player_left', handler)

    unsubscribe()
    socket.serverSend({ type: 'player_left', payload: { playerId: 'user-2' } })

    expect(handler).not.toHaveBeenCalled()
  })
})

describe('diagnostics', () => {
  it('reports issue paths and codes without any payload content', () => {
    const payload = {
      roomId: openRoom.id,
      roomCode: 'ABC123',
      players: [{ ...hostPlayer, name: 42, sessionToken: 'session-secret' }],
      discordLink: SECRET_INVITE,
    }

    expect(parseServerEvent('room_joined', payload)).toBeNull()

    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket payload:', {
      type: 'room_joined',
      issues: [{ path: 'players.0.name', code: 'invalid_type' }],
    })
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logged).not.toContain(SECRET_INVITE)
    expect(logged).not.toContain('session-secret')
  })

  it('drops a frame without a string type before any handler runs', () => {
    const { client, socket } = connectedClient()
    const handler = vi.fn()
    client.on('undefined', handler)

    socket.onmessage?.(
      new MessageEvent('message', { data: JSON.stringify({ payload: { room: SECRET_INVITE } }) })
    )
    socket.onmessage?.(new MessageEvent('message', { data: '42' }))

    expect(handler).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket message:', {
      issues: [{ path: 'type', code: 'invalid_type' }],
    })
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(SECRET_INVITE)
  })
})
