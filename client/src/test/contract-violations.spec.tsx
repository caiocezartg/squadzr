/**
 * Contract enforcement as seen from the real Squad Board (`/squads`) and lobby
 * (`/squads/$code`) pages (CCC-34): an HTTP response or WebSocket message that
 * breaks its contract in @squadzr/schemas never reaches the UI state, and the
 * public projection keeps the Discord invite and the roster away from non-members.
 *
 * HTTP runs through the deterministic adapter (./http-router) and WebSocket
 * through the mock socket (./ws-mock).
 */

import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSquadsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { boardSquads, lobbySquad, lobbySquadResponse, lobbySnapshot, openSquad } from './fixtures'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import { toastStore } from './stubs'
import type { PublicSquad, RoomsResponse } from '@/types'

const { discordLink: _discordLink, ...publicLobbySquad } = lobbySquad

const newSquad: PublicSquad = {
  ...openSquad,
  id: 'aaaaaaaa-0000-4000-8000-00000000000b',
  code: 'NEW002',
  name: 'Fresh squad',
}

beforeEach(() => {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('board', () => {
  it('shows the load error instead of rendering a board response that breaks the contract', async () => {
    onHttp('GET', '/api/rooms', () =>
      httpOk({ rooms: [{ ...openSquad, maxPlayers: 'five' }, boardSquads.rooms[1]] })
    )
    renderSquadsFlow('/squads')

    expect(
      await screen.findByText('Failed to load squads. Please refresh the page.')
    ).toBeInTheDocument()
    expect(screen.queryByText(openSquad.name)).not.toBeInTheDocument()
    expect(console.error).toHaveBeenCalledWith('Invalid API response:', {
      method: 'GET',
      path: '/api/rooms',
      status: 200,
      issues: [{ path: 'rooms.0.maxPlayers', code: 'invalid_type' }],
    })
  })

  it('never caches the Discord invite of a board squad', async () => {
    const { queryClient } = renderSquadsFlow('/squads', { user: null })
    await screen.findByText(openSquad.name)

    const cached = queryClient.getQueryData<RoomsResponse>(['squads'])

    expect(cached?.rooms).toHaveLength(boardSquads.rooms.length)
    expect(JSON.stringify(cached)).not.toContain('discordLink')
    expect(JSON.stringify(cached)).not.toContain(openSquad.discordLink)
  })

  it('rejects a join response that breaks the contract instead of entering the lobby', async () => {
    onHttp('POST', '/api/rooms/:code/join', () => httpOk({ ok: true }))
    const { navigation, user } = renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)

    await user.click(screen.getByText(openSquad.name))

    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Invalid API response:', {
        method: 'POST',
        path: `/api/rooms/${openSquad.code}/join`,
        status: 200,
        issues: expect.arrayContaining([
          { path: 'message', code: 'invalid_type' },
          { path: 'roomMember', code: 'invalid_type' },
        ]),
      })
    )
    expect(navigation.history.location.pathname).toBe('/squads')
    await waitFor(() =>
      expect(toastStore.errorCalls[0]).toBe('Something went wrong. Please try again.')
    )
  })

  it('ignores a room_created event that breaks the contract and applies the next valid one', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverSquads))
    const { queryClient } = renderSquadsFlow('/squads', { user: null })
    await screen.findByText(openSquad.name)
    openLatestWebSocket()

    sendFromServer({ type: 'room_created', payload: { room: { ...newSquad, maxPlayers: 'many' } } })
    sendFromServer({ type: 'room_updated', payload: { roomId: openSquad.id, memberCount: 'many' } })

    // Contract-breaking events never reach the page, so no refetch runs and
    // the cache keeps the authoritative list it already had.
    expect(screen.queryByText(newSquad.name)).not.toBeInTheDocument()
    expect(queryClient.getQueryData<RoomsResponse>(['squads'])?.rooms).toHaveLength(
      boardSquads.rooms.length
    )
    expect(console.error).toHaveBeenCalledWith('Invalid WebSocket payload:', {
      type: 'room_created',
      issues: [{ path: 'room.maxPlayers', code: 'invalid_type' }],
    })

    // The next valid event refetches the board, which now carries the squad.
    serverSquads.rooms = [...serverSquads.rooms, newSquad]
    sendFromServer({ type: 'room_created', payload: { room: newSquad } })

    expect(await screen.findByText(newSquad.name)).toBeInTheDocument()
  })
})

describe('lobby', () => {
  it('shows the not-found state when the squad response breaks the contract', async () => {
    onHttp('GET', '/api/rooms/:code', () =>
      httpOk({ room: { ...lobbySquad, createdAt: 1_769_000_000 }, players: [] })
    )
    renderSquadsFlow('/squads/LOBBY1')

    expect(await screen.findByText('Squad not found')).toBeInTheDocument()
    expect(screen.queryByText(lobbySquad.name)).not.toBeInTheDocument()
  })

  it('renders a non-member view from the public projection, without roster or invite', async () => {
    onHttp('GET', '/api/rooms/:code', () => httpOk({ room: publicLobbySquad }))
    renderSquadsFlow('/squads/LOBBY1', {
      user: { id: 'user-7', name: 'Outsider', email: 'outsider@squadzr.test', image: null },
    })

    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    expect(screen.getByText('0/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for player...')).toHaveLength(3)

    // Readiness comes only from a member snapshot, which a non-member never
    // receives, so nothing can unlock the invite or lock the leave button.
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave squad' })).toBeEnabled()
  })

  it('ignores a squad snapshot and a presence event that break the contract', async () => {
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText(lobbySquad.name)
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
