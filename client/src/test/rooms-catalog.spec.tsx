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
import type { MockHttpResponse } from './http-router'
import {
  catalogGames,
  catalogRooms,
  fullRoom,
  gameLol,
  guestPlayer,
  hostPlayer,
  joinRoomResponse,
  lobbyRoom,
  lobbyRoomResponse,
  memberRoom,
  openRoom,
  roomReadyNotification,
  roomsForPagination,
} from './fixtures'
import { authStore, toastStore } from './stubs'
import { openLatestWebSocket, sendFromServer, serverSentFrames } from './ws-flows'
import { MockWebSocket } from './ws-mock'
import { CATALOG_REFETCH_DEBOUNCE_MS } from '@/features/catalog/catalog-refetch-scheduler'
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
  onHttp('POST', '/api/rooms/:code/join', () => httpOk(joinRoomResponse))
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

describe('rooms catalog — removal without cached rooms', () => {
  it('fetches the catalog when a directly opened lobby room is deleted', async () => {
    const remainingRooms = catalogRooms.rooms.filter((room) => room.id !== lobbyRoom.id)
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: remainingRooms }))
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbyRoomResponse))
    onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))

    const { router } = renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    // The room leaves the catalog while the catalog query was never loaded.
    sendFromServer({
      type: 'room_deleted',
      payload: { roomId: lobbyRoom.id, roomCode: lobbyRoom.code },
    })

    await waitFor(() => expect(router.history.location.pathname).toBe('/rooms'))
    // The catalog must fetch on mount: a fabricated fresh empty list would
    // keep it blank for the whole staleTime window.
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBe(1)
  })

  it('does not flash an empty catalog when a room_removed arrives before the first response', async () => {
    let releaseFirstResponse: (() => void) | undefined
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    onHttp(
      'GET',
      '/api/rooms',
      () =>
        new Promise<MockHttpResponse>((resolve) => {
          releaseFirstResponse = () => resolve(httpOk(serverRooms))
        })
    )

    renderRoomsFlow('/rooms')
    // The catalog stays on its skeleton while the first GET is pending; the
    // socket still opens, so the removal can arrive mid-load.
    await waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThan(0))
    openLatestWebSocket()

    vi.useFakeTimers()
    try {
      sendFromServer({
        type: 'room_removed',
        payload: { roomId: fullRoom.id, roomCode: fullRoom.code },
      })
      // Flush the React notification: a fabricated empty list would render now.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.queryByText('No squads yet')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }

    // The held authoritative response still lands, without an empty flash.
    releaseFirstResponse?.()
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
  })
})

describe('rooms catalog — in-flight fetch after removal', () => {
  it('cancels the in-flight fetch so its response cannot bring the room back', async () => {
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    let holdNextResponse = false
    let releaseHeldResponse: (() => void) | undefined
    onHttp('GET', '/api/rooms', () => {
      if (!holdNextResponse) return httpOk(serverRooms)
      // Snapshot the server list when the request is made: the response in
      // flight still carries the room the removal will drop.
      const staleRooms = { rooms: [...serverRooms.rooms] }
      return new Promise<MockHttpResponse>((resolve) => {
        releaseHeldResponse = () => resolve(httpOk(staleRooms))
      })
    })

    const { queryClient } = renderRoomsFlow('/rooms')
    await screen.findByText('Full lobby')
    openLatestWebSocket()

    vi.useFakeTimers()
    try {
      // A coalesced refetch starts while the server still lists the room; its
      // response is held so the removal happens with that fetch in flight.
      holdNextResponse = true
      sendFromServer({
        type: 'room_updated',
        payload: { roomId: openRoom.id, roomCode: openRoom.code, memberCount: 2 },
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })
      expect(releaseHeldResponse).toBeDefined()

      // The room leaves the catalog while the fetch is pending.
      serverRooms.rooms = serverRooms.rooms.filter((room) => room.id !== fullRoom.id)
      sendFromServer({
        type: 'room_removed',
        payload: { roomId: fullRoom.id, roomCode: fullRoom.code },
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.queryByText('Full lobby')).not.toBeInTheDocument()

      // The pre-removal response lands and must not resurrect the room.
      releaseHeldResponse?.()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.queryByText('Full lobby')).not.toBeInTheDocument()
      expect(
        queryClient
          .getQueryData<RoomsResponse>(['rooms'])
          ?.rooms.some((room) => room.id === fullRoom.id)
      ).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rooms catalog — pending refetch across unmount', () => {
  it('drops the pending refetch on unmount and fetches once on the next mount', async () => {
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverRooms))
    const queryClient = createTestQueryClient()
    const first = renderRoomsFlow('/rooms', { queryClient })
    await screen.findByText('Ranked grind')
    openLatestWebSocket()

    const fetchesBefore = countHttpCalls('GET', '/api/rooms')

    vi.useFakeTimers()
    try {
      // A realtime event asks for a refetch that is still waiting when the
      // user navigates away.
      serverRooms.rooms = [...serverRooms.rooms, extraRoom]
      sendFromServer({ type: 'room_created', payload: { room: extraRoom } })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBefore)

      first.unmount()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })

      // The dropped refetch must not fire after the unmount; the guarantee
      // moves to the mount, which always re-reads the catalog.
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBefore)
    } finally {
      vi.useRealTimers()
    }

    renderRoomsFlow('/rooms', { queryClient })
    expect(await screen.findByText('Extra room')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBefore + 1)
  })
})

describe('rooms catalog — refetch on mount', () => {
  it('re-reads on mount and surfaces a room created while the user was away', async () => {
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    let holdNextRoomsResponse = false
    let releaseRoomsResponse: (() => void) | undefined
    onHttp('GET', '/api/rooms', () => {
      if (!holdNextRoomsResponse) return httpOk({ rooms: [...serverRooms.rooms] })
      const responseRooms = { rooms: [...serverRooms.rooms] }
      return new Promise<MockHttpResponse>((resolve) => {
        releaseRoomsResponse = () => resolve(httpOk(responseRooms))
      })
    })

    const queryClient = createTestQueryClient()
    const firstVisit = renderRoomsFlow('/rooms', { queryClient })
    await screen.findByText('Ranked grind')
    firstVisit.unmount()

    // While the catalog is off screen (e.g. in the lobby) its realtime
    // channel is not subscribed, so a room another player creates never
    // reaches this tab. The cache is younger than the 60 s staleTime, so it
    // would look fresh without being fresh.
    serverRooms.rooms = [...serverRooms.rooms, extraRoom]

    holdNextRoomsResponse = true
    const fetchesBeforeReturn = countHttpCalls('GET', '/api/rooms')
    const returningVisit = renderRoomsFlow('/rooms', { queryClient })

    // The cached list paints while the mount GET is still in flight: the
    // page is not waiting on the request, so there is no skeleton and no
    // empty state.
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeReturn + 1))
    // The held request is still in flight while the cached rooms are on
    // screen — the page never fell back to the skeleton.
    expect(queryClient.getQueryState(['rooms'])?.fetchStatus).toBe('fetching')
    expect(screen.queryByText('No squads yet')).not.toBeInTheDocument()

    releaseRoomsResponse?.()
    expect(await screen.findByText('Extra room')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeReturn + 1)

    returningVisit.unmount()
  })

  it('issues exactly one GET per mount', async () => {
    const queryClient = createTestQueryClient()
    const firstVisit = renderRoomsFlow('/rooms', { queryClient })
    await screen.findByText('Ranked grind')
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(1))
    firstVisit.unmount()

    renderRoomsFlow('/rooms', { queryClient })
    await screen.findByText('Ranked grind')
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(2))

    // The cached render plus the mount refetch must not fan out into another
    // request once the response lands.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(countHttpCalls('GET', '/api/rooms')).toBe(2)
  })

  it('collapses a stale marker left before the visit into a single GET', async () => {
    const queryClient = createTestQueryClient()
    const firstVisit = renderRoomsFlow('/rooms', { queryClient })
    await screen.findByText('Ranked grind')
    firstVisit.unmount()
    const fetchesBeforeReturn = countHttpCalls('GET', '/api/rooms')

    // `refreshRooms()` marks the cache stale while no catalog is mounted (as
    // a mutation does before navigating to the lobby); mounting must still
    // fetch exactly once.
    await queryClient.invalidateQueries({ queryKey: ['rooms'] })
    renderRoomsFlow('/rooms', { queryClient })
    await screen.findByText('Ranked grind')
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeReturn + 1))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeReturn + 1)
  })

  it('ignores the acknowledgement of its own subscription, staying at one GET', async () => {
    renderRoomsFlow('/rooms')
    await screen.findByText('Ranked grind')
    openLatestWebSocket()

    vi.useFakeTimers()
    try {
      // The first `lobby_subscribed` only confirms the subscription of the
      // mount; the mount fetch already covers the list, so no refetch is due.
      sendFromServer({ type: 'lobby_subscribed', payload: { message: 'Subscribed' } })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(CATALOG_REFETCH_DEBOUNCE_MS)
      })
      expect(countHttpCalls('GET', '/api/rooms')).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('deduplicates the mount fetch under StrictMode', async () => {
    renderRoomsFlow('/rooms', { strictMode: true })
    await screen.findByText('Ranked grind')
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(1))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(countHttpCalls('GET', '/api/rooms')).toBe(1)
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
      httpError(409, { message: 'Room is full', error: 'ROOM_FULL' })
    )
    const { router, user } = renderRoomsFlow('/rooms')

    await user.click(await screen.findByText('Ranked grind'))

    await waitFor(() => expect(toastStore.errorCalls[0]).toBe('This squad is already full.'))
    expect(router.history.location.pathname).toBe('/rooms')
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
  })

  it.each([
    ['ROOM_FULL', 'This squad is already full.'],
    ['ROOM_READY', "This squad is already full and ready — it's no longer accepting players."],
    ['ROOM_JOIN_LIMIT_REACHED', 'You have reached the maximum number of squads you can join.'],
  ])(
    'surfaces the %s lifecycle error through the typed application error',
    async (errorCode, message) => {
      onHttp('POST', '/api/rooms/:code/join', () =>
        httpError(409, { message: 'join refused', error: errorCode })
      )
      const { router, user } = renderRoomsFlow('/rooms')

      await user.click(await screen.findByText('Ranked grind'))

      await waitFor(() => expect(toastStore.errorCalls[0]).toBe(message))
      expect(router.history.location.pathname).toBe('/rooms')
    }
  )
})
