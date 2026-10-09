/**
 * Characterization of the typed realtime client (CCC-38) as seen from the real
 * catalog (`/rooms`) and lobby (`/rooms/$code`) pages: reconnection with
 * backoff, resubscription owned by the transport, snapshot replacement of
 * stale state, duplicate-event idempotency and the HTTP/WebSocket state
 * ownership that removed the old `playersInitialized` race.
 *
 * Pages render with real timers; the socket drop and the reconnect delay then
 * run under fake timers. `Math.random` is pinned to 0 so the jittered backoff
 * is deterministic (3000 ms on the first attempt).
 */

import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoomsFlow } from './harness'
import { countHttpCalls, httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import {
  catalogGames,
  catalogRooms,
  gameLol,
  guestPlayer,
  hostPlayer,
  lobbyRoom,
  lobbyRoomResponse,
  lobbySnapshot,
  openRoom,
} from './fixtures'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import { MockWebSocket, latestWebSocket } from './ws-mock'

const DROPPED = 1006
const FIRST_RECONNECT_DELAY = 3000

function registerRoutes(): void {
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
  onHttp('GET', '/api/rooms/:code', () => httpOk(lobbyRoomResponse))
  onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
}

/** Drops the current socket and lets the first reconnection attempt fire. */
function dropAndReconnect(): MockWebSocket {
  const dropped = latestWebSocket()
  vi.useFakeTimers()
  act(() => dropped.close(DROPPED))
  act(() => vi.advanceTimersByTime(FIRST_RECONNECT_DELAY - 1))
  expect(latestWebSocket()).toBe(dropped)
  act(() => vi.advanceTimersByTime(1))
  const next = latestWebSocket()
  expect(next).not.toBe(dropped)
  act(() => next.open())
  vi.useRealTimers()
  return next
}

function frameTypes(socket: MockWebSocket): string[] {
  return socket.sentFrames().map((frame) => frame.type)
}

beforeEach(() => {
  registerRoutes()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('catalog subscription', () => {
  it('re-sends subscribe_lobby on the new socket and refetches on its events idempotently', async () => {
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverRooms))
    renderRoomsFlow('/rooms', { user: null })
    await screen.findByText(openRoom.name)
    openLatestWebSocket()
    expect(frameTypes(latestWebSocket())).toEqual(['subscribe_lobby'])

    const reconnected = dropAndReconnect()

    expect(frameTypes(reconnected)).toEqual(['subscribe_lobby'])

    // The authoritative server state no longer has the room; the duplicated
    // removed events each refetch the catalog and it stays deduplicated.
    const fetchesBeforeRemoval = countHttpCalls('GET', '/api/rooms')
    serverRooms.rooms = serverRooms.rooms.filter((room) => room.id !== openRoom.id)
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: openRoom.id, roomCode: openRoom.code },
    })
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: openRoom.id, roomCode: openRoom.code },
    })
    await vi.waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesBeforeRemoval)
    )
    await vi.waitFor(() => expect(screen.queryByText(openRoom.name)).not.toBeInTheDocument())
  })

  it('refetches the catalog when the subscription is restored after a reconnect', async () => {
    renderRoomsFlow('/rooms', { user: null })
    await screen.findByText(openRoom.name)
    openLatestWebSocket()
    sendFromServer({
      type: 'lobby_subscribed',
      payload: { message: 'Subscribed to room list updates' },
    })
    const initialFetches = countHttpCalls('GET', '/api/rooms')

    dropAndReconnect()
    sendFromServer({
      type: 'lobby_subscribed',
      payload: { message: 'Subscribed to room list updates' },
    })

    // Events missed while the socket was down are repaired by the refetch.
    await vi.waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(initialFetches)
    )
  })

  it('closes the socket on unmount without unsubscribe_lobby and never reconnects', async () => {
    renderRoomsFlow('/rooms', { user: null })
    await screen.findByText(openRoom.name)
    openLatestWebSocket()
    const socket = latestWebSocket()

    vi.useFakeTimers()
    cleanup()
    vi.runAllTimers()

    // The server-side catalog entry is released by the close, not by a message.
    expect(socket.readyState).toBe(MockWebSocket.CLOSED)
    expect(frameTypes(socket)).toEqual(['subscribe_lobby'])
    expect(MockWebSocket.instances).toHaveLength(1)
  })
})

describe('room channel subscription', () => {
  it('re-sends join_room after reconnecting and replaces the roster from a fresh snapshot', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText(lobbyRoom.name)
    openLatestWebSocket()
    expect(latestWebSocket().sentFrames()).toEqual([
      { type: 'join_room', payload: { roomCode: 'LOBBY1' } },
    ])

    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(await screen.findByText('Ana')).toBeInTheDocument()

    const reconnected = dropAndReconnect()

    expect(reconnected.sentFrames()).toEqual([
      { type: 'join_room', payload: { roomCode: 'LOBBY1' } },
    ])
    // The member who left while the socket was down is gone after the snapshot.
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({
        players: [hostPlayer],
        presence: [{ playerId: hostPlayer.id, online: true }],
      }),
    })
    await vi.waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument())
    expect(screen.getByText('1/3 players')).toBeInTheDocument()
  })

  it('leaves the previous room on a code switch and ignores its late events', async () => {
    const nextRoom = {
      ...lobbyRoom,
      id: 'aaaaaaaa-0000-4000-8000-000000000007',
      code: 'NEXT01',
      name: 'Next squad',
    }
    onHttp('GET', '/api/rooms/:code', (req) => {
      if (req.params.code === nextRoom.code)
        return httpOk({ room: nextRoom, players: [hostPlayer] })
      return httpOk(lobbyRoomResponse)
    })

    const { router } = renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText(lobbyRoom.name)
    openLatestWebSocket()
    const socket = latestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(await screen.findByText('Ana')).toBeInTheDocument()

    await act(() => router.navigate({ to: '/rooms/$code', params: { code: nextRoom.code } }))

    // The same socket releases the previous room channel before joining the new one.
    await vi.waitFor(() =>
      expect(socket.sentFrames()).toEqual([
        { type: 'join_room', payload: { roomCode: 'LOBBY1' } },
        { type: 'leave_room', payload: { roomCode: 'LOBBY1' } },
        { type: 'join_room', payload: { roomCode: nextRoom.code } },
      ])
    )

    // Events from the previous room, already in flight, never touch this page.
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: true },
    })
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()

    // The new room's snapshot is applied.
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({
        room: { ...nextRoom, memberCount: 2, isMember: true },
        players: [hostPlayer, guestPlayer],
      }),
    })
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
  })

  it('keeps the last roster and Presence frozen while disconnected', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText(lobbyRoom.name)
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')

    vi.useFakeTimers()
    act(() => latestWebSocket().close(DROPPED))

    // No offline transition is invented locally; the next snapshot converges.
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument()
  })

  it('leaves the room channel by closing the socket, without leave_room, on navigation', async () => {
    const { router } = renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText(lobbyRoom.name)
    openLatestWebSocket()
    const lobbySocket = latestWebSocket()

    await act(() => router.navigate({ to: '/rooms', search: {} }))
    await screen.findByText(openRoom.name)

    // Leaving the route affects Presence only (server emits presence_updated on close).
    expect(lobbySocket.readyState).toBe(MockWebSocket.CLOSED)
    expect(frameTypes(lobbySocket)).toEqual(['join_room'])
    expect(latestWebSocket()).not.toBe(lobbySocket)
  })
})

describe('live state ownership', () => {
  it('never lets a late HTTP response overwrite the roster from the snapshot', async () => {
    let releaseRoomResponse: (() => void) | undefined
    onHttp(
      'GET',
      '/api/rooms/:code',
      () =>
        new Promise<MockHttpResponse>((resolve) => {
          releaseRoomResponse = () => resolve(httpOk(lobbyRoomResponse))
        })
    )

    renderRoomsFlow('/rooms/LOBBY1')
    // The page is still loading while the HTTP response is held back, so wait
    // for the route to mount and open its socket.
    await vi.waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThan(0))
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })

    releaseRoomResponse?.()
    expect(await screen.findByText('Squad ready check')).toBeInTheDocument()

    // HTTP returns only the host, but the live roster comes from the snapshot.
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
  })
})
