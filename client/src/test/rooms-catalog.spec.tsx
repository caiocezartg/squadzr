/**
 * Characterization tests for the rooms catalog page (`/rooms`).
 *
 * Covers the observable behavior of catalog rendering, filters (search,
 * status, language, sort), pagination, lobby WebSocket cache updates, the
 * join flows (guest → auth modal, authenticated → POST, member → direct
 * navigation, failure → friendly error) and load-error presentation.
 *
 * HTTP runs through the deterministic adapter (./http-router) and WebSocket
 * through the mock socket (./ws-mock). No test touches private hook state or
 * generated route details.
 */

import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderRoomsFlow } from './harness'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import {
  catalogGames,
  catalogRooms,
  fullRoom,
  gameLol,
  guestPlayer,
  hostPlayer,
  lobbyRoomResponse,
  memberRoom,
  openRoom,
  roomsForPagination,
} from './fixtures'
import { authStore, toastStore } from './stubs'
import { openLatestWebSocket, sendFromServer, serverSentFrames } from './ws-flows'
import type { Room, RoomsResponse } from '@/types'

const extraRoom: Room = {
  id: 'aaaaaaaa-0000-4000-8000-00000000000a',
  code: 'EXTR01',
  name: 'Extra room',
  hostId: 'user-9',
  gameId: gameLol.id,
  status: 'waiting',
  maxPlayers: 5,
  discordLink: null,
  tags: [],
  language: 'en',
  memberCount: 1,
  isMember: false,
  createdAt: new Date(Date.now() - 300_000).toISOString(),
  updatedAt: new Date(Date.now() - 300_000).toISOString(),
}

function registerCatalogRoutes(): void {
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
}

function registerLobbyRoutes(): void {
  onHttp('GET', '/api/rooms/:code', (req) => {
    if (req.params.code === openRoom.code) return httpOk(lobbyRoomResponse)
    if (req.params.code === memberRoom.code) {
      return httpOk({ room: memberRoom, players: [guestPlayer, hostPlayer] })
    }
    return httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
  })
  onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
  onHttp('POST', '/api/rooms/:code/join', () => httpOk({ ok: true }))
}

beforeEach(() => {
  registerCatalogRoutes()
})

describe('rooms catalog — rendering', () => {
  it('renders every room with its game, member count and join state', async () => {
    renderRoomsFlow('/rooms')

    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.getByText('Full lobby')).toBeInTheDocument()
    expect(screen.getByText('Casual five stack')).toBeInTheDocument()
    expect(screen.getAllByText('League of Legends')).toHaveLength(2)
    expect(screen.getByText('Joined')).toBeInTheDocument()
    expect(screen.getByText('3 squads available')).toBeInTheDocument()
  })

  it('shows the empty state without a create action for guests', async () => {
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: [] }))
    renderRoomsFlow('/rooms', { user: null })

    expect(await screen.findByText('No squads yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create Squad' })).not.toBeInTheDocument()
  })

  it('shows the inline load error when the catalog request fails', async () => {
    onHttp('GET', '/api/rooms', () => httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' }))
    renderRoomsFlow('/rooms')

    expect(
      await screen.findByText('Failed to load squads. Please refresh the page.')
    ).toBeInTheDocument()
  })
})

describe('rooms catalog — filters', () => {
  it('filters rooms by debounced search term', async () => {
    const { user } = renderRoomsFlow('/rooms')
    await screen.findByText('Ranked grind')

    await user.type(screen.getByPlaceholderText('Search by game or squad name...'), 'Ranked')

    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByText('Casual five stack')).not.toBeInTheDocument()
  })

  it('filters rooms by status chips', async () => {
    const { user } = renderRoomsFlow('/rooms')
    await screen.findByText('Ranked grind')

    await user.click(screen.getByRole('button', { name: 'HAS SPACE' }))
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.getByText('Casual five stack')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ALMOST FULL' }))
    await waitFor(() => expect(screen.queryByText('Ranked grind')).not.toBeInTheDocument())
    expect(screen.getByText('Casual five stack')).toBeInTheDocument()
  })

  it('filters rooms by language chips', async () => {
    const { user } = renderRoomsFlow('/rooms')
    await screen.findByText('Ranked grind')

    await user.click(screen.getByRole('button', { name: 'EN-US' }))

    await waitFor(() => expect(screen.queryByText('Casual five stack')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByText('Full lobby')).not.toBeInTheDocument()
  })

  it('sorts rooms by creation date through the sort select', async () => {
    const { user } = renderRoomsFlow('/rooms')
    await screen.findByText('Ranked grind')

    const titles = () =>
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(titles()).toEqual(['Ranked grind', 'Full lobby', 'Casual five stack'])

    await user.selectOptions(screen.getByRole('combobox'), 'oldest')
    await waitFor(() =>
      expect(titles()).toEqual(['Casual five stack', 'Full lobby', 'Ranked grind'])
    )
  })
})

describe('rooms catalog — pagination', () => {
  it('paginates the room grid across pages', async () => {
    onHttp('GET', '/api/rooms', () => httpOk(roomsForPagination()))
    const { user } = renderRoomsFlow('/rooms')

    expect(await screen.findByText('Page room 1')).toBeInTheDocument()
    expect(screen.queryByText('Page room 7')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }))

    expect(await screen.findByText('Page room 7')).toBeInTheDocument()
    expect(screen.queryByText('Page room 1')).not.toBeInTheDocument()
  })
})

describe('rooms catalog — lobby WebSocket cache updates', () => {
  it('subscribes to the lobby and applies created/updated/deleted events', async () => {
    const { queryClient } = renderRoomsFlow('/rooms')
    await screen.findByText('Ranked grind')

    openLatestWebSocket()
    await waitFor(() =>
      expect(serverSentFrames()).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'subscribe_lobby' })])
      )
    )

    sendFromServer({ type: 'room_created', payload: { room: extraRoom } })
    expect(await screen.findByText('Extra room')).toBeInTheDocument()
    const cachedAfterCreate = queryClient.getQueryData<RoomsResponse>(['rooms'])
    expect(cachedAfterCreate?.rooms.some((room) => room.id === extraRoom.id)).toBe(true)

    sendFromServer({
      type: 'room_updated',
      payload: { roomId: openRoom.id, roomCode: openRoom.code, memberCount: 3 },
    })
    // The count renders as `<span>3</span>/5` — assert within the room card.
    const openCard = screen.getByText('Ranked grind').closest('button')
    expect(openCard).not.toBeNull()
    await waitFor(() =>
      expect(within(openCard as HTMLElement).getByText('3', { exact: true })).toBeInTheDocument()
    )

    sendFromServer({
      type: 'room_deleted',
      payload: { roomId: fullRoom.id, roomCode: fullRoom.code },
    })
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    const cachedAfterDelete = queryClient.getQueryData<RoomsResponse>(['rooms'])
    expect(cachedAfterDelete?.rooms.some((room) => room.id === fullRoom.id)).toBe(false)
  })
})

describe('rooms catalog — join flows', () => {
  it('requires sign-in before a guest can join and defers to Discord', async () => {
    const { user } = renderRoomsFlow('/rooms', { user: null })

    await user.click(await screen.findByText('Ranked grind'))

    expect(await screen.findByText('Sign in required')).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Continue with Discord' }))
    expect(authStore.signInSocialCalls[0]).toMatchObject({
      provider: 'discord',
      callbackURL: expect.stringContaining('/rooms?join=ABC123'),
    })
  })

  it('joins as an authenticated user, refreshes the catalog and opens the lobby', async () => {
    registerLobbyRoutes()
    const { router, user } = renderRoomsFlow('/rooms')

    await user.click(await screen.findByText('Ranked grind'))

    await waitFor(() => expect(router.history.location.pathname).toBe('/rooms/ABC123'))
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1)
    expect(await screen.findByText('Squad ready check')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThanOrEqual(2)

    openLatestWebSocket()
    await waitFor(() =>
      expect(serverSentFrames()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'join_room',
            payload: { roomCode: 'ABC123' },
          }),
        ])
      )
    )
  })

  it('auto-joins a room from a shared ?join link and returns to the catalog', async () => {
    // Current behavior (recorded, not endorsed): after the authenticated
    // auto-join, the search-clear navigate in useAutoJoin resolves relative
    // to the `/rooms/` route, so the user ends up back on the catalog even
    // though the lobby was briefly mounted and the join POST succeeded.
    registerLobbyRoutes()
    const { router } = renderRoomsFlow('/rooms?join=ABC123')

    await waitFor(() => expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1))
    expect(countHttpCalls('GET', `/api/rooms/${openRoom.code}`)).toBe(1)

    await waitFor(() => expect(router.history.location.pathname).toBe('/rooms'))
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1)
  })

  it('opens the lobby directly for rooms the user already belongs to', async () => {
    registerLobbyRoutes()
    const { router, user } = renderRoomsFlow('/rooms')

    await user.click(await screen.findByText('Casual five stack'))

    await waitFor(() => expect(router.history.location.pathname).toBe('/rooms/MEM111'))
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(0)
    expect(await screen.findByText('Casual five stack')).toBeInTheDocument()
  })

  it('shows a friendly toast and stays in the catalog when joining fails', async () => {
    onHttp('POST', '/api/rooms/:code/join', () =>
      httpError(409, { message: 'Room already joined', error: 'ALREADY_IN_ROOM' })
    )
    const { router, user } = renderRoomsFlow('/rooms')

    await user.click(await screen.findByText('Ranked grind'))

    await waitFor(() =>
      expect(toastStore.errorCalls[0]).toBe('You are already a member of this squad.')
    )
    expect(router.history.location.pathname).toBe('/rooms')
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
  })
})
