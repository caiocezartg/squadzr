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

import { act, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient, renderRoomsFlow } from './harness'
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
  roomReadyNotification,
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

describe('rooms catalog — realtime refetch updates', () => {
  it('refetches on created/updated/removed events and renders each room once', async () => {
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverRooms))
    const { queryClient } = renderRoomsFlow('/rooms')
    await screen.findByText('Ranked grind')

    openLatestWebSocket()
    await waitFor(() =>
      expect(serverSentFrames()).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'subscribe_lobby' })])
      )
    )

    // The server creates a room; the event refetches the authoritative list.
    // Duplicate events stay idempotent: the room renders and caches once.
    const fetchesBeforeCreate = countHttpCalls('GET', '/api/rooms')
    serverRooms.rooms = [...serverRooms.rooms, extraRoom]
    sendFromServer({ type: 'room_created', payload: { room: extraRoom } })
    sendFromServer({ type: 'room_created', payload: { room: extraRoom } })
    expect(await screen.findByText('Extra room')).toBeInTheDocument()
    expect(screen.getAllByText('Extra room')).toHaveLength(1)
    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesBeforeCreate)
    )
    const cachedAfterCreate = queryClient.getQueryData<RoomsResponse>(['rooms'])
    expect(cachedAfterCreate?.rooms.filter((room) => room.id === extraRoom.id)).toHaveLength(1)

    // A Membership change refetches the new count instead of patching it in.
    serverRooms.rooms = serverRooms.rooms.map((room) =>
      room.id === openRoom.id ? { ...room, memberCount: 3 } : room
    )
    sendFromServer({
      type: 'room_updated',
      payload: { roomId: openRoom.id, roomCode: openRoom.code, memberCount: 3 },
    })
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

    // A Ready/expired room leaves the server list; the event refetches the
    // catalog until the room is gone.
    serverRooms.rooms = serverRooms.rooms.filter((room) => room.id !== fullRoom.id)
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: fullRoom.id, roomCode: fullRoom.code },
    })
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: fullRoom.id, roomCode: fullRoom.code },
    })
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    const cachedAfterDelete = queryClient.getQueryData<RoomsResponse>(['rooms'])
    expect(cachedAfterDelete?.rooms.some((room) => room.id === fullRoom.id)).toBe(false)
  })

  it('drops a Ready room through authoritative state and never resurrects it from a late room_created', async () => {
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverRooms))
    const { queryClient } = renderRoomsFlow('/rooms')
    await screen.findByText('Full lobby')

    openLatestWebSocket()

    // The room becomes Ready: the server drops it from the catalog list and
    // announces room_removed without waiting for any polling.
    serverRooms.rooms = serverRooms.rooms.filter((room) => room.id !== fullRoom.id)
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: fullRoom.id, roomCode: fullRoom.code },
    })
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    const fetchesAfterRemoval = countHttpCalls('GET', '/api/rooms')

    // A late room_created for the same room must not patch it back into the
    // cache: the event schedules the authoritative refetch, and the server
    // list no longer has the room.
    const cachedRoomIds = () =>
      queryClient.getQueryData<RoomsResponse>(['rooms'])?.rooms.map((room) => room.id) ?? []
    sendFromServer({ type: 'room_created', payload: { room: fullRoom } })
    expect(cachedRoomIds()).not.toContain(fullRoom.id)

    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesAfterRemoval)
    )
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(cachedRoomIds()).not.toContain(fullRoom.id)
  })

  it('applies a pushed notification to the notifications cache without duplicating it', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['notifications', { limit: 10 }], { notifications: [] })
    renderRoomsFlow('/rooms', { queryClient })
    await screen.findByText('Ranked grind')

    openLatestWebSocket()
    sendFromServer({
      type: 'notification',
      payload: { notification: roomReadyNotification },
    })

    await waitFor(() =>
      expect(
        queryClient.getQueryData<{ notifications: unknown[] }>(['notifications', { limit: 10 }])
          ?.notifications
      ).toHaveLength(1)
    )

    sendFromServer({
      type: 'notification',
      payload: { notification: roomReadyNotification },
    })
    expect(
      queryClient.getQueryData<{ notifications: unknown[] }>(['notifications', { limit: 10 }])
        ?.notifications
    ).toHaveLength(1)
  })

  it('clips the pushed notification to the limit of each notifications query', async () => {
    const olderNotification = {
      ...roomReadyNotification,
      id: '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6c',
      title: 'Older notification',
    }
    const pushedNotification = {
      ...roomReadyNotification,
      id: '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6d',
      title: 'Pushed notification',
    }
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['notifications', { limit: 2 }], {
      notifications: [roomReadyNotification, olderNotification],
    })
    renderRoomsFlow('/rooms', { queryClient })
    await screen.findByText('Ranked grind')

    openLatestWebSocket()
    sendFromServer({
      type: 'notification',
      payload: { notification: pushedNotification },
    })

    // The newest push stays first and the list never grows past the query's
    // limit; the oldest notification falls off before the next poll.
    await waitFor(() =>
      expect(
        queryClient.getQueryData<{ notifications: unknown[] }>(['notifications', { limit: 2 }])
          ?.notifications
      ).toEqual([
        expect.objectContaining({ id: pushedNotification.id }),
        expect.objectContaining({ id: roomReadyNotification.id }),
      ])
    )
  })
})

describe('rooms catalog — coalesced realtime refetch', () => {
  it('collapses a burst of events into one refetch and drops a removed room before it', async () => {
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverRooms))
    const { queryClient } = renderRoomsFlow('/rooms')
    await screen.findByText('Full lobby')
    openLatestWebSocket()

    const fetchesBeforeBurst = countHttpCalls('GET', '/api/rooms')

    vi.useFakeTimers()
    try {
      // Three events inside the debounce window share a single refetch...
      for (const memberCount of [2, 3, 4]) {
        sendFromServer({
          type: 'room_updated',
          payload: { roomId: openRoom.id, roomCode: openRoom.code, memberCount },
        })
      }
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeBurst)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(299)
      })
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeBurst)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeBurst + 1)

      // ...while a removed room leaves the screen on the event itself, before
      // the coalesced refetch lands.
      serverRooms.rooms = serverRooms.rooms.filter((room) => room.id !== fullRoom.id)
      sendFromServer({
        type: 'room_removed',
        payload: { roomId: fullRoom.id, roomCode: fullRoom.code },
      })
      // Flush the React notification, not the 300 ms refetch timer.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.queryByText('Full lobby')).not.toBeInTheDocument()
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeBurst + 1)

      // The coalesced refetch then converges with the authoritative list.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeBurst + 2)
      expect(
        queryClient
          .getQueryData<RoomsResponse>(['rooms'])
          ?.rooms.some((room) => room.id === fullRoom.id)
      ).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps refetching while a burst of events outlives maxWait', async () => {
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverRooms))
    renderRoomsFlow('/rooms')
    await screen.findByText('Ranked grind')
    openLatestWebSocket()

    const fetchesBeforeBurst = countHttpCalls('GET', '/api/rooms')

    vi.useFakeTimers()
    try {
      // An event every 100 ms for two seconds: the debounce never expires and
      // only maxWait can make progress.
      for (let elapsed = 0; elapsed <= 2_000; elapsed += 100) {
        sendFromServer({
          type: 'room_updated',
          payload: { roomId: openRoom.id, roomCode: openRoom.code, memberCount: 2 },
        })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(100)
        })
      }

      // maxWait fired at 1000 ms and 2000 ms even though the burst continued.
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeBurst + 2)

      // Once the events stop, the trailing debounce adds one more refetch.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeBurst + 3)
    } finally {
      vi.useRealTimers()
    }
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
