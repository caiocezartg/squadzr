/**
 * Contract enforcement as seen from the real catalog (`/rooms`) and lobby
 * (`/rooms/$code`) pages (CCC-34): an HTTP response or WebSocket message that
 * breaks its contract in @squadzr/schemas never reaches the UI state, and the
 * public projection keeps the Discord invite and the roster away from non-members.
 *
 * HTTP runs through the deterministic adapter (./http-router) and WebSocket
 * through the mock socket (./ws-mock).
 */

import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoomsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import {
  catalogGames,
  catalogRooms,
  gameLol,
  lobbyRoom,
  lobbyRoomResponse,
  lobbySnapshot,
  openRoom,
} from './fixtures'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import type { PublicRoom, RoomsResponse } from '@/types'

const { discordLink: _discordLink, ...publicLobbyRoom } = lobbyRoom

const newRoom: PublicRoom = {
  ...openRoom,
  id: 'aaaaaaaa-0000-4000-8000-00000000000b',
  code: 'NEW002',
  name: 'Fresh squad',
}

beforeEach(() => {
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
  onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('catalog', () => {
  it('shows the load error instead of rendering a catalog response that breaks the contract', async () => {
    onHttp('GET', '/api/rooms', () =>
      httpOk({ rooms: [{ ...openRoom, maxPlayers: 'five' }, catalogRooms.rooms[1]] })
    )
    renderRoomsFlow('/rooms')

    expect(
      await screen.findByText('Failed to load squads. Please refresh the page.')
    ).toBeInTheDocument()
    expect(screen.queryByText(openRoom.name)).not.toBeInTheDocument()
    expect(console.error).toHaveBeenCalledWith('Invalid API response:', {
      method: 'GET',
      path: '/api/rooms',
      status: 200,
      issues: [{ path: 'rooms.0.maxPlayers', code: 'invalid_type' }],
    })
  })

  it('never caches the Discord invite of a catalog room', async () => {
    const { queryClient } = renderRoomsFlow('/rooms', { user: null })
    await screen.findByText(openRoom.name)

    const cached = queryClient.getQueryData<RoomsResponse>(['rooms'])

    expect(cached?.rooms).toHaveLength(catalogRooms.rooms.length)
    expect(JSON.stringify(cached)).not.toContain('discordLink')
    expect(JSON.stringify(cached)).not.toContain(openRoom.discordLink)
  })

  it('ignores a room_created event that breaks the contract and applies the next valid one', async () => {
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverRooms))
    const { queryClient } = renderRoomsFlow('/rooms', { user: null })
    await screen.findByText(openRoom.name)
    openLatestWebSocket()

    sendFromServer({ type: 'room_created', payload: { room: { ...newRoom, maxPlayers: 'many' } } })
    sendFromServer({ type: 'room_updated', payload: { roomId: openRoom.id, memberCount: 'many' } })

    // Contract-breaking events never reach the page, so no refetch runs and
    // the cache keeps the authoritative list it already had.
    expect(screen.queryByText(newRoom.name)).not.toBeInTheDocument()
    expect(queryClient.getQueryData<RoomsResponse>(['rooms'])?.rooms).toHaveLength(
      catalogRooms.rooms.length
    )
    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket payload:', {
      type: 'room_created',
      issues: [{ path: 'room.maxPlayers', code: 'invalid_type' }],
    })

    // The next valid event refetches the catalog, which now carries the room.
    serverRooms.rooms = [...serverRooms.rooms, newRoom]
    sendFromServer({ type: 'room_created', payload: { room: newRoom } })

    expect(await screen.findByText(newRoom.name)).toBeInTheDocument()
  })
})

describe('lobby', () => {
  it('shows the not-found state when the room response breaks the contract', async () => {
    onHttp('GET', '/api/rooms/:code', () =>
      httpOk({ room: { ...lobbyRoom, createdAt: 1_769_000_000 }, players: [] })
    )
    renderRoomsFlow('/rooms/LOBBY1')

    expect(await screen.findByText('Squad not found')).toBeInTheDocument()
    expect(screen.queryByText(lobbyRoom.name)).not.toBeInTheDocument()
  })

  it('renders a non-member view from the public projection, without roster or invite', async () => {
    onHttp('GET', '/api/rooms/:code', () => httpOk({ room: publicLobbyRoom }))
    renderRoomsFlow('/rooms/LOBBY1', {
      user: { id: 'user-7', name: 'Outsider', email: 'outsider@squadzr.test', image: null },
    })

    expect(await screen.findByText(lobbyRoom.name)).toBeInTheDocument()
    expect(screen.getByText('0/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for player...')).toHaveLength(3)

    // Readiness comes only from a member snapshot, which a non-member never
    // receives, so nothing can unlock the invite or lock the leave button.
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave squad' })).toBeEnabled()
  })

  it('ignores a room snapshot and a presence event that break the contract', async () => {
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbyRoomResponse))
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText(lobbyRoom.name)
    openLatestWebSocket()

    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()

    sendFromServer({
      type: 'room_snapshot',
      payload: { ...lobbySnapshot(), players: [{ id: 'user-2' }] },
    })
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: 'user-2', online: 'yes' },
    })

    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
  })
})
