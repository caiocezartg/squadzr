/**
 * Characterization of reconnect, resubscribe and subscription cleanup as seen from the
 * real catalog (`/rooms`) and lobby (`/rooms/$code`) pages.
 *
 * Pages render with real timers; the socket drop and the reconnect delay then run under
 * fake timers, so the 3 s backoff is advanced deterministically instead of awaited.
 * Resubscription today is a side effect of `isConnected` flipping back to true: the
 * catalog re-sends `subscribe_lobby` and the lobby re-sends `join_room`, whose server
 * reply (`room_joined`) replaces the roster. Assertions tagged `REPLACED BY CCC-38`
 * record behavior the typed realtime client (snapshots + Presence) will change.
 */

import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoomsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import {
  catalogGames,
  catalogRooms,
  gameLol,
  guestPlayer,
  hostPlayer,
  lobbyRoom,
  lobbyRoomResponse,
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
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('catalog subscription', () => {
  it('re-sends subscribe_lobby on the new socket and applies its events', async () => {
    renderRoomsFlow('/rooms', { user: null })
    await screen.findByText(openRoom.name)
    openLatestWebSocket()
    expect(frameTypes(latestWebSocket())).toEqual(['subscribe_lobby'])

    const reconnected = dropAndReconnect()

    expect(frameTypes(reconnected)).toEqual(['subscribe_lobby'])
    sendFromServer({
      type: 'room_deleted',
      payload: { roomId: openRoom.id, roomCode: openRoom.code },
    })
    await vi.waitFor(() => expect(screen.queryByText(openRoom.name)).not.toBeInTheDocument())
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
  it('re-sends join_room after reconnecting and replaces the roster from room_joined', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText(lobbyRoom.name)
    openLatestWebSocket()
    expect(latestWebSocket().sentFrames()).toEqual([
      { type: 'join_room', payload: { roomCode: 'LOBBY1' } },
    ])

    const reconnected = dropAndReconnect()

    expect(reconnected.sentFrames()).toEqual([
      { type: 'join_room', payload: { roomCode: 'LOBBY1' } },
    ])
    sendFromServer({
      type: 'room_joined',
      payload: { roomId: lobbyRoom.id, roomCode: 'LOBBY1', players: [hostPlayer, guestPlayer] },
    })
    expect(await screen.findByText(guestPlayer.name)).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
  })

  it('keeps the last roster while disconnected', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText(lobbyRoom.name)
    openLatestWebSocket()
    sendFromServer({
      type: 'room_joined',
      payload: { roomId: lobbyRoom.id, roomCode: 'LOBBY1', players: [hostPlayer, guestPlayer] },
    })
    await screen.findByText(guestPlayer.name)

    vi.useFakeTimers()
    act(() => latestWebSocket().close(DROPPED))

    // REPLACED BY CCC-38: no offline state per member; the roster is simply frozen.
    expect(screen.getByText(guestPlayer.name)).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
  })

  it('ignores viewer_left, so a disconnected member still looks present', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText(lobbyRoom.name)
    openLatestWebSocket()
    sendFromServer({
      type: 'room_joined',
      payload: { roomId: lobbyRoom.id, roomCode: 'LOBBY1', players: [hostPlayer, guestPlayer] },
    })
    await screen.findByText(guestPlayer.name)

    sendFromServer({
      type: 'viewer_left',
      payload: { playerId: guestPlayer.id, roomCode: 'LOBBY1' },
    })

    // REPLACED BY CCC-38: the server's socket-level Presence signal has no consumer.
    expect(screen.getByText(guestPlayer.name)).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
  })

  it('leaves the room channel by closing the socket, without leave_room, on navigation', async () => {
    const { router } = renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText(lobbyRoom.name)
    openLatestWebSocket()
    const lobbySocket = latestWebSocket()

    await act(() => router.navigate({ to: '/rooms', search: {} }))
    await screen.findByText(openRoom.name)

    // Leaving the route affects Presence only (server emits viewer_left on close).
    expect(lobbySocket.readyState).toBe(MockWebSocket.CLOSED)
    expect(frameTypes(lobbySocket)).toEqual(['join_room'])
    expect(latestWebSocket()).not.toBe(lobbySocket)
  })
})
