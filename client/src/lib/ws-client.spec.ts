/**
 * Characterization of the typed transport `WebSocketClient`: connection
 * lifecycle, runtime validation of outbound frames, exponential backoff with
 * jitter, subscription replay after reconnects, handler lifetime, protocol
 * handshake detection and message parsing.
 *
 * The global `WebSocket` is the deterministic `MockWebSocket` (src/test/setup.ts).
 * `random: () => 0` pins the jitter to the capped exponential delay so the
 * timers stay deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketClient } from './ws-client'
import { MockWebSocket, latestWebSocket } from '@/test/ws-mock'

const URL = 'ws://squadzr.test/ws'
const DROPPED = 1006
const ROOM_UPDATED = {
  roomId: 'aaaaaaaa-0000-4000-8000-000000000001',
  roomCode: 'ABC123',
  memberCount: 3,
}

function createClient(overrides: Partial<ConstructorParameters<typeof WebSocketClient>[0]> = {}) {
  const callbacks = {
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn(),
    onProtocolFailure: vi.fn(),
  }
  const client = new WebSocketClient({ url: URL, random: () => 0, ...callbacks, ...overrides })
  return { client, ...callbacks }
}

/** Advances to just before and exactly at `delay`, returning the socket count at each point. */
function socketsAround(delay: number): [number, number] {
  vi.advanceTimersByTime(delay - 1)
  const before = MockWebSocket.instances.length
  vi.advanceTimersByTime(1)
  return [before, MockWebSocket.instances.length]
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('connection lifecycle', () => {
  it('opens one socket and ignores connect() while connecting or open', () => {
    const { client, onOpen } = createClient()

    client.connect()
    client.connect()
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(latestWebSocket().url).toBe(URL)

    latestWebSocket().open()
    client.connect()

    expect(MockWebSocket.instances).toHaveLength(1)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(client.isConnected).toBe(true)
  })

  it('sends validated { type, payload } frames only while open', () => {
    const { client } = createClient()
    client.connect()

    client.send({ type: 'subscribe_lobby' })
    latestWebSocket().open()
    client.send({ type: 'join_room', payload: { roomCode: 'abcdef' } })

    expect(latestWebSocket().sentFrames()).toEqual([
      { type: 'join_room', payload: { roomCode: 'ABCDEF' } },
    ])
    expect(console.warn).toHaveBeenCalledWith('WebSocket is not connected. Message not sent:', {
      type: 'subscribe_lobby',
    })
  })

  it('rejects a frame that breaks its contract before it reaches the socket', () => {
    const { client } = createClient()
    client.connect()
    latestWebSocket().open()

    client.send({ type: 'join_room', payload: { roomCode: 'ABC' } } as never)

    expect(latestWebSocket().sentFrames()).toEqual([])
    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket message:', {
      type: 'join_room',
      issues: [{ path: 'payload.roomCode', code: 'too_small' }],
    })
  })

  it('disconnect() closes the socket without firing onClose or reconnecting', () => {
    const { client, onClose } = createClient()
    client.connect()
    const socket = latestWebSocket()
    socket.open()

    client.disconnect()
    vi.runAllTimers()

    expect(socket.readyState).toBe(MockWebSocket.CLOSED)
    expect(onClose).not.toHaveBeenCalled()
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(client.isConnected).toBe(false)
    expect(client.status).toBe('closed')
  })
})

describe('reconnection', () => {
  it('backs off exponentially with jitter and stops after 5 attempts', () => {
    const { client, onClose } = createClient()
    client.connect()
    latestWebSocket().open()

    latestWebSocket().close(DROPPED)

    // random: () => 0 pins every delay to the capped exponential value.
    for (const delay of [3000, 6000, 12_000, 24_000, 30_000]) {
      const [before, after] = socketsAround(delay)
      expect(after).toBe(before + 1)
      latestWebSocket().close(DROPPED)
    }

    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(6)
    expect(onClose).toHaveBeenCalledTimes(6)
    expect(console.error).toHaveBeenCalledWith('Max reconnection attempts reached')
    expect(client.status).toBe('closed')
  })

  it('reduces the delay by up to half with jitter', () => {
    const { client } = createClient({ random: () => 0.5 })
    client.connect()
    latestWebSocket().open()
    latestWebSocket().close(DROPPED)

    // 3000 * (1 - 0.5 * 0.5) = 2250
    vi.advanceTimersByTime(2249)
    expect(MockWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('resets the backoff after a successful reconnection', () => {
    const { client } = createClient()
    client.connect()
    latestWebSocket().open()

    latestWebSocket().close(DROPPED)
    vi.advanceTimersByTime(3000)
    latestWebSocket().close(DROPPED)
    vi.advanceTimersByTime(6000)
    latestWebSocket().open()
    latestWebSocket().close(DROPPED)

    expect(socketsAround(3000)).toEqual([3, 4])
  })

  it('reconnects after an abnormal or clean close but stops on policy closes', () => {
    const { client } = createClient()
    client.connect()
    latestWebSocket().open()

    latestWebSocket().close(1000)
    vi.advanceTimersByTime(3000)
    latestWebSocket().open()

    // 1009 (oversized frame) and 1008 (too many invalid messages) are terminal:
    // retrying would repeat the same violation.
    latestWebSocket().close(1009)
    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(2)

    client.disconnect()
    client.connect()
    latestWebSocket().open()
    latestWebSocket().close(1008)
    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(3)
  })

  it('cancels a pending reconnection on disconnect()', () => {
    const { client } = createClient()
    client.connect()
    latestWebSocket().open()
    latestWebSocket().close(DROPPED)

    client.disconnect()
    vi.runAllTimers()

    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('replays active subscriptions on every connection until unsubscribed', () => {
    const { client } = createClient()
    client.connect()

    const unsubscribe = client.subscribe({ type: 'subscribe_lobby' }, {})
    expect(latestWebSocket().sentFrames()).toEqual([])

    latestWebSocket().open()
    expect(latestWebSocket().sentFrames()).toEqual([{ type: 'subscribe_lobby' }])

    latestWebSocket().close(DROPPED)
    vi.advanceTimersByTime(3000)
    latestWebSocket().open()
    expect(latestWebSocket().sentFrames()).toEqual([{ type: 'subscribe_lobby' }])

    unsubscribe()
    latestWebSocket().close(DROPPED)
    vi.advanceTimersByTime(3000)
    latestWebSocket().open()
    expect(latestWebSocket().sentFrames()).toEqual([])
  })
})

describe('event handlers', () => {
  it('keeps handlers registered across reconnections until unsubscribed', () => {
    const { client } = createClient()
    const handler = vi.fn()
    const unsubscribe = client.on('room_updated', handler)
    client.connect()
    latestWebSocket().open()
    latestWebSocket().serverSend({ type: 'room_updated', payload: ROOM_UPDATED })

    latestWebSocket().close(DROPPED)
    vi.advanceTimersByTime(3000)
    latestWebSocket().open()
    latestWebSocket().serverSend({
      type: 'room_updated',
      payload: { ...ROOM_UPDATED, memberCount: 4 },
    })
    unsubscribe()
    latestWebSocket().serverSend({
      type: 'room_updated',
      payload: { ...ROOM_UPDATED, memberCount: 5 },
    })

    expect(handler.mock.calls).toEqual([[ROOM_UPDATED], [{ ...ROOM_UPDATED, memberCount: 4 }]])
  })

  it('hands channel handlers only validated payloads and ignores unknown types', () => {
    const { client } = createClient()
    const handler = vi.fn()
    client.subscribe({ type: 'subscribe_lobby' }, { room_updated: handler })
    client.connect()
    const socket = latestWebSocket()
    socket.open()

    socket.serverSend({ type: 'something_else' })
    socket.serverSend({ type: 'toString' })
    socket.serverSend({ type: 'room_updated', payload: { n: 1 } })
    socket.serverSend({ type: 'room_updated', payload: ROOM_UPDATED })

    expect(handler.mock.calls).toEqual([[ROOM_UPDATED]])
    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket payload:', {
      type: 'room_updated',
      issues: expect.arrayContaining([{ path: 'roomId', code: 'invalid_type' }]),
    })
  })

  it('dispatches only the validated payload of a valid frame', () => {
    const { client } = createClient()
    const handler = vi.fn()
    client.on('room_updated', handler)
    client.connect()
    const socket = latestWebSocket()
    socket.open()

    socket.serverSend({ type: 'room_updated', payload: ROOM_UPDATED })

    expect(handler.mock.calls).toEqual([[ROOM_UPDATED]])
  })

  it('reports a frame that cannot be parsed and stops the connection', () => {
    const { client, onProtocolFailure } = createClient()
    const handler = vi.fn()
    client.on('room_updated', handler)
    client.connect()
    const socket = latestWebSocket()
    socket.open()

    socket.onmessage?.(new MessageEvent('message', { data: '{not json' }))

    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket message:', {
      issues: [{ path: '', code: 'invalid_json' }],
    })
    expect(handler).not.toHaveBeenCalled()
    expect(onProtocolFailure).toHaveBeenCalledWith('unparseable_frame')
    expect(client.isConnected).toBe(false)
  })

  it('reports a throwing handler by event type only and keeps the connection', () => {
    const { client } = createClient()
    client.on('room_updated', () => {
      throw new Error('cannot handle it')
    })
    client.connect()
    const socket = latestWebSocket()
    socket.open()

    socket.serverSend({ type: 'room_updated', payload: ROOM_UPDATED })

    expect(console.error).toHaveBeenCalledWith('WebSocket handler failed:', {
      type: 'room_updated',
    })
    expect(client.isConnected).toBe(true)
  })
})

describe('protocol handshake', () => {
  it('accepts the announcement of the matching version', () => {
    const { client, onProtocolFailure } = createClient()
    client.connect()
    latestWebSocket().open()

    latestWebSocket().serverSend({ type: 'protocol', payload: { version: 2 } })

    expect(onProtocolFailure).not.toHaveBeenCalled()
    expect(client.status).toBe('open')
  })

  it('reports a version mismatch and stops reconnecting', () => {
    const { client, onProtocolFailure } = createClient()
    client.connect()
    const socket = latestWebSocket()
    socket.open()

    socket.serverSend({ type: 'protocol', payload: { version: 99 } })

    expect(onProtocolFailure).toHaveBeenCalledWith('version_mismatch')
    expect(socket.readyState).toBe(MockWebSocket.CLOSED)
    expect(client.status).toBe('closed')

    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(1)

    // A failed handshake is terminal for this build: no new socket is opened.
    client.connect()
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('reports an announcement that cannot be parsed', () => {
    const { client, onProtocolFailure } = createClient()
    client.connect()
    latestWebSocket().open()

    latestWebSocket().serverSend({ type: 'protocol', payload: { version: 'two' } })

    expect(onProtocolFailure).toHaveBeenCalledWith('invalid_protocol')
  })
})
