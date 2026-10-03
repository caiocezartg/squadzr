/**
 * Characterization of the transport-level `WebSocketClient`: connection lifecycle,
 * reconnection backoff (driven with fake timers), handler lifetime and message parsing.
 *
 * The global `WebSocket` is the deterministic `MockWebSocket` (src/test/setup.ts).
 * Assertions tagged `REPLACED BY CCC-38` record behavior the typed realtime client
 * (explicit state machine, backoff with jitter, snapshot resubscription) will change.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketClient } from './ws-client'
import { MockWebSocket, latestWebSocket } from '@/test/ws-mock'

const URL = 'ws://squadzr.test/ws'
const DROPPED = 1006

function createClient(overrides: Partial<ConstructorParameters<typeof WebSocketClient>[0]> = {}) {
  const callbacks = { onOpen: vi.fn(), onClose: vi.fn(), onError: vi.fn() }
  const client = new WebSocketClient({ url: URL, ...callbacks, ...overrides })
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

  it('sends { type, payload } frames only while open and drops them otherwise', () => {
    const { client } = createClient()
    client.connect()

    client.send('subscribe_lobby', {})
    latestWebSocket().open()
    client.send('join_room', { roomCode: 'ABCDEF' })

    expect(latestWebSocket().sentFrames()).toEqual([
      { type: 'join_room', payload: { roomCode: 'ABCDEF' } },
    ])
    expect(console.warn).toHaveBeenCalledWith('WebSocket is not connected. Message not sent:', {
      type: 'subscribe_lobby',
      payload: {},
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
  })
})

describe('reconnection', () => {
  it('reconnects after 3 s, doubling the delay per failed attempt, and stops after 5 attempts', () => {
    const { client, onClose } = createClient()
    client.connect()
    latestWebSocket().open()

    latestWebSocket().close(DROPPED)

    // REPLACED BY CCC-38: fixed exponential backoff without jitter.
    for (const delay of [3000, 6000, 12_000, 24_000, 48_000]) {
      const [before, after] = socketsAround(delay)
      expect(after).toBe(before + 1)
      latestWebSocket().close(DROPPED)
    }

    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(6)
    expect(onClose).toHaveBeenCalledTimes(6)
    expect(console.error).toHaveBeenCalledWith('Max reconnection attempts reached')
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

  it('also reconnects after a clean server close and after a 1009 oversized-frame close', () => {
    const { client } = createClient()
    client.connect()
    latestWebSocket().open()

    // REPLACED BY CCC-38: close codes are not inspected; a policy close is retried too.
    latestWebSocket().close(1000)
    vi.advanceTimersByTime(3000)
    latestWebSocket().open()
    latestWebSocket().close(1009)
    vi.advanceTimersByTime(3000)

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

  it('does not replay frames that were dropped while reconnecting', () => {
    const { client } = createClient()
    client.connect()
    latestWebSocket().open()
    latestWebSocket().close(DROPPED)

    client.send('subscribe_lobby', {})
    vi.advanceTimersByTime(3000)
    latestWebSocket().open()

    // REPLACED BY CCC-38: resubscription is the caller's job (see realtime-reconnect.spec).
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
    latestWebSocket().serverSend({ type: 'room_updated', payload: { n: 1 } })

    latestWebSocket().close(DROPPED)
    vi.advanceTimersByTime(3000)
    latestWebSocket().open()
    latestWebSocket().serverSend({ type: 'room_updated', payload: { n: 2 } })
    unsubscribe()
    latestWebSocket().serverSend({ type: 'room_updated', payload: { n: 3 } })

    expect(handler.mock.calls).toEqual([[{ n: 1 }], [{ n: 2 }]])
  })

  it('dispatches only the payload, ignores unknown types and logs malformed frames', () => {
    const { client } = createClient()
    const handler = vi.fn()
    client.on('pong', handler)
    client.connect()
    const socket = latestWebSocket()
    socket.open()

    socket.onmessage?.(new MessageEvent('message', { data: '{not json' }))
    socket.serverSend({ type: 'something_else' })
    socket.serverSend({ type: 'pong', payload: { ok: true } })

    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket message:', {
      issues: [{ path: '', code: 'invalid_json' }],
    })
    expect(handler.mock.calls).toEqual([[{ ok: true }]])
    expect(client.isConnected).toBe(true)
  })
})
