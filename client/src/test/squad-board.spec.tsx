/**
 * Characterization tests for the Squad Board page (`/squads`).
 *
 * Covers the observable behavior of board rendering, filters (search,
 * status, language, sort), pagination, lobby WebSocket cache updates, the
 * join flows (guest → auth modal, authenticated → POST, member → direct
 * navigation, failure → friendly error) and load-error presentation.
 *
 * HTTP runs through the deterministic adapter (./http-router) and WebSocket
 * through the mock socket (./ws-mock). No test touches private hook state or
 * generated route details.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import {
  boardGames,
  boardSquads,
  fullSquad,
  gameLol,
  guestPlayer,
  hostPlayer,
  joinRoomResponse,
  lobbySquad,
  lobbyRoomResponse,
  memberSquad,
  openSquad,
  roomReadyNotification,
  squadsForPagination,
} from './fixtures'
import { authStore, toastStore } from './stubs'
import { openLatestWebSocket, sendFromServer, serverSentFrames } from './ws-flows'
import { MockWebSocket } from './ws-mock'
import { SQUAD_BOARD_REFETCH_DEBOUNCE_MS } from '@/features/squad-board/squad-board-refetch-scheduler'
import type { RoomsResponse, Squad } from '@/types'

const extraSquad: Squad = {
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

function registerBoardRoutes(): void {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/games', () => httpOk(boardGames))
}

function registerLobbyRoutes(): void {
  onHttp('GET', '/api/rooms/:code', (req) => {
    if (req.params.code === openSquad.code) return httpOk(lobbyRoomResponse)
    if (req.params.code === memberSquad.code) {
      return httpOk({ room: memberSquad, players: [guestPlayer, hostPlayer] })
    }
    return httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
  })
  onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
  onHttp('POST', '/api/rooms/:code/join', () => httpOk(joinRoomResponse))
}

beforeEach(() => {
  registerBoardRoutes()
})

describe('squad board — rendering', () => {
  it('renders every squad with its game, member count and join state', async () => {
    renderSquadsFlow('/squads')

    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.getByText('Full lobby')).toBeInTheDocument()
    expect(screen.getByText('Casual five stack')).toBeInTheDocument()
    expect(screen.getAllByText('League of Legends')).toHaveLength(2)
    expect(screen.getByText('Joined')).toBeInTheDocument()
    expect(screen.getByText('3 squads available')).toBeInTheDocument()
  })

  it('shows the empty state without a create action for guests', async () => {
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: [] }))
    renderSquadsFlow('/squads', { user: null })

    expect(await screen.findByText('No squads yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create Squad' })).not.toBeInTheDocument()
  })

  it('shows the inline load error when the board request fails', async () => {
    onHttp('GET', '/api/rooms', () => httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' }))
    renderSquadsFlow('/squads')

    expect(
      await screen.findByText('Failed to load squads. Please refresh the page.')
    ).toBeInTheDocument()
  })
})

describe('squad board — filters', () => {
  it('filters squads by debounced search term', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')

    await user.type(screen.getByPlaceholderText('Search by game or squad name...'), 'Ranked')

    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByText('Casual five stack')).not.toBeInTheDocument()
  })

  it('filters squads by status chips', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')

    await user.click(screen.getByRole('button', { name: 'HAS SPACE' }))
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.getByText('Casual five stack')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ALMOST FULL' }))
    await waitFor(() => expect(screen.queryByText('Ranked grind')).not.toBeInTheDocument())
    expect(screen.getByText('Casual five stack')).toBeInTheDocument()
  })

  it('filters squads by language chips', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')

    await user.click(screen.getByRole('button', { name: 'EN-US' }))

    await waitFor(() => expect(screen.queryByText('Casual five stack')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByText('Full lobby')).not.toBeInTheDocument()
  })

  it('sorts squads by creation date through the sort select', async () => {
    const { user } = renderSquadsFlow('/squads')
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

describe('squad board — pagination', () => {
  it('paginates the squad grid across pages', async () => {
    onHttp('GET', '/api/rooms', () => httpOk(squadsForPagination()))
    const { user } = renderSquadsFlow('/squads')

    expect(await screen.findByText('Page room 1')).toBeInTheDocument()
    expect(screen.queryByText('Page room 7')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }))

    expect(await screen.findByText('Page room 7')).toBeInTheDocument()
    expect(screen.queryByText('Page room 1')).not.toBeInTheDocument()
  })
})

describe('squad board — realtime refetch updates', () => {
  it('refetches on created/updated/removed events and renders each squad once', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverSquads))
    const { queryClient } = renderSquadsFlow('/squads')
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
    serverSquads.rooms = [...serverSquads.rooms, extraSquad]
    sendFromServer({ type: 'room_created', payload: { room: extraSquad } })
    sendFromServer({ type: 'room_created', payload: { room: extraSquad } })
    expect(await screen.findByText('Extra room')).toBeInTheDocument()
    expect(screen.getAllByText('Extra room')).toHaveLength(1)
    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesBeforeCreate)
    )
    const cachedAfterCreate = queryClient.getQueryData<RoomsResponse>(['squads'])
    expect(cachedAfterCreate?.rooms.filter((room) => room.id === extraSquad.id)).toHaveLength(1)

    // A Membership change refetches the new count instead of patching it in.
    serverSquads.rooms = serverSquads.rooms.map((room) =>
      room.id === openSquad.id ? { ...room, memberCount: 3 } : room
    )
    sendFromServer({
      type: 'room_updated',
      payload: { roomId: openSquad.id, roomCode: openSquad.code, memberCount: 3 },
    })
    sendFromServer({
      type: 'room_updated',
      payload: { roomId: openSquad.id, roomCode: openSquad.code, memberCount: 3 },
    })
    // The count renders as `<span>3</span>/5` — assert within the room card.
    const openCard = screen.getByText('Ranked grind').closest('button')
    expect(openCard).not.toBeNull()
    await waitFor(() =>
      expect(within(openCard as HTMLElement).getByText('3', { exact: true })).toBeInTheDocument()
    )

    // A Ready/expired room leaves the server list; the event refetches the
    // board until the room is gone.
    serverSquads.rooms = serverSquads.rooms.filter((room) => room.id !== fullSquad.id)
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: fullSquad.id, roomCode: fullSquad.code },
    })
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: fullSquad.id, roomCode: fullSquad.code },
    })
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    const cachedAfterDelete = queryClient.getQueryData<RoomsResponse>(['squads'])
    expect(cachedAfterDelete?.rooms.some((room) => room.id === fullSquad.id)).toBe(false)
  })

  it('drops a Ready squad through authoritative state and never resurrects it from a late room_created', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverSquads))
    const { queryClient } = renderSquadsFlow('/squads')
    await screen.findByText('Full lobby')

    openLatestWebSocket()

    // The room becomes Ready: the server drops it from the board list and
    // announces room_removed without waiting for any polling.
    serverSquads.rooms = serverSquads.rooms.filter((room) => room.id !== fullSquad.id)
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: fullSquad.id, roomCode: fullSquad.code },
    })
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    const fetchesAfterRemoval = countHttpCalls('GET', '/api/rooms')

    // A late room_created for the same room must not patch it back into the
    // cache: the event schedules the authoritative refetch, and the server
    // list no longer has the room.
    const cachedRoomIds = () =>
      queryClient.getQueryData<RoomsResponse>(['squads'])?.rooms.map((room) => room.id) ?? []
    sendFromServer({ type: 'room_created', payload: { room: fullSquad } })
    expect(cachedRoomIds()).not.toContain(fullSquad.id)

    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesAfterRemoval)
    )
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(cachedRoomIds()).not.toContain(fullSquad.id)
  })

  it('applies a pushed notification to the notifications cache without duplicating it', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['notifications', { limit: 10 }], { notifications: [] })
    renderSquadsFlow('/squads', { queryClient })
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
    renderSquadsFlow('/squads', { queryClient })
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

describe('squad board — coalesced realtime refetch', () => {
  it('collapses a burst of events into one refetch and drops a removed squad before it', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverSquads))
    const { queryClient } = renderSquadsFlow('/squads')
    await screen.findByText('Full lobby')
    openLatestWebSocket()

    const fetchesBeforeBurst = countHttpCalls('GET', '/api/rooms')

    vi.useFakeTimers()
    try {
      // Three events inside the debounce window share a single refetch...
      for (const memberCount of [2, 3, 4]) {
        sendFromServer({
          type: 'room_updated',
          payload: { roomId: openSquad.id, roomCode: openSquad.code, memberCount },
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
      serverSquads.rooms = serverSquads.rooms.filter((room) => room.id !== fullSquad.id)
      sendFromServer({
        type: 'room_removed',
        payload: { roomId: fullSquad.id, roomCode: fullSquad.code },
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
          .getQueryData<RoomsResponse>(['squads'])
          ?.rooms.some((room) => room.id === fullSquad.id)
      ).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps refetching while a burst of events outlives maxWait', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverSquads))
    renderSquadsFlow('/squads')
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
          payload: { roomId: openSquad.id, roomCode: openSquad.code, memberCount: 2 },
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

describe('squad board — removal without cached squads', () => {
  it('fetches the board when a directly opened lobby squad is deleted', async () => {
    const remainingRooms = boardSquads.rooms.filter((room) => room.id !== lobbySquad.id)
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: remainingRooms }))
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbyRoomResponse))
    onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))

    const { router } = renderSquadsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    // The room leaves the board while the board query was never loaded.
    sendFromServer({
      type: 'room_deleted',
      payload: { roomId: lobbySquad.id, roomCode: lobbySquad.code },
    })

    await waitFor(() => expect(router.history.location.pathname).toBe('/squads'))
    // The board must fetch on mount: a fabricated fresh empty list would
    // keep it blank for the whole staleTime window.
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBe(1)
  })

  it('does not flash an empty board when a room_removed arrives before the first response', async () => {
    let releaseFirstResponse: (() => void) | undefined
    const serverSquads = { rooms: [...boardSquads.rooms] }
    onHttp(
      'GET',
      '/api/rooms',
      () =>
        new Promise<MockHttpResponse>((resolve) => {
          releaseFirstResponse = () => resolve(httpOk(serverSquads))
        })
    )

    renderSquadsFlow('/squads')
    // The board stays on its skeleton while the first GET is pending; the
    // socket still opens, so the removal can arrive mid-load.
    await waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThan(0))
    openLatestWebSocket()

    vi.useFakeTimers()
    try {
      sendFromServer({
        type: 'room_removed',
        payload: { roomId: fullSquad.id, roomCode: fullSquad.code },
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

describe('squad board — in-flight fetch after removal', () => {
  it('cancels the in-flight fetch so its response cannot bring the squad back', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    let holdNextResponse = false
    let releaseHeldResponse: (() => void) | undefined
    onHttp('GET', '/api/rooms', () => {
      if (!holdNextResponse) return httpOk(serverSquads)
      // Snapshot the server list when the request is made: the response in
      // flight still carries the room the removal will drop.
      const staleRooms = { rooms: [...serverSquads.rooms] }
      return new Promise<MockHttpResponse>((resolve) => {
        releaseHeldResponse = () => resolve(httpOk(staleRooms))
      })
    })

    const { queryClient } = renderSquadsFlow('/squads')
    await screen.findByText('Full lobby')
    openLatestWebSocket()

    vi.useFakeTimers()
    try {
      // A coalesced refetch starts while the server still lists the room; its
      // response is held so the removal happens with that fetch in flight.
      holdNextResponse = true
      sendFromServer({
        type: 'room_updated',
        payload: { roomId: openSquad.id, roomCode: openSquad.code, memberCount: 2 },
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })
      expect(releaseHeldResponse).toBeDefined()

      // The room leaves the board while the fetch is pending.
      serverSquads.rooms = serverSquads.rooms.filter((room) => room.id !== fullSquad.id)
      sendFromServer({
        type: 'room_removed',
        payload: { roomId: fullSquad.id, roomCode: fullSquad.code },
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
          .getQueryData<RoomsResponse>(['squads'])
          ?.rooms.some((room) => room.id === fullSquad.id)
      ).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('squad board — pending refetch across unmount', () => {
  it('drops the pending refetch on unmount and fetches once on the next mount', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverSquads))
    const queryClient = createTestQueryClient()
    const first = renderSquadsFlow('/squads', { queryClient })
    await screen.findByText('Ranked grind')
    openLatestWebSocket()

    const fetchesBefore = countHttpCalls('GET', '/api/rooms')

    vi.useFakeTimers()
    try {
      // A realtime event asks for a refetch that is still waiting when the
      // user navigates away.
      serverSquads.rooms = [...serverSquads.rooms, extraSquad]
      sendFromServer({ type: 'room_created', payload: { room: extraSquad } })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBefore)

      first.unmount()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })

      // The dropped refetch must not fire after the unmount; the guarantee
      // moves to the mount, which always re-reads the board.
      expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBefore)
    } finally {
      vi.useRealTimers()
    }

    renderSquadsFlow('/squads', { queryClient })
    expect(await screen.findByText('Extra room')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBefore + 1)
  })
})

describe('squad board — refetch on mount', () => {
  it('re-reads on mount and surfaces a squad created while the user was away', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    let holdNextRoomsResponse = false
    let releaseRoomsResponse: (() => void) | undefined
    onHttp('GET', '/api/rooms', () => {
      if (!holdNextRoomsResponse) return httpOk({ rooms: [...serverSquads.rooms] })
      const responseRooms = { rooms: [...serverSquads.rooms] }
      return new Promise<MockHttpResponse>((resolve) => {
        releaseRoomsResponse = () => resolve(httpOk(responseRooms))
      })
    })

    const queryClient = createTestQueryClient()
    const firstVisit = renderSquadsFlow('/squads', { queryClient })
    await screen.findByText('Ranked grind')
    firstVisit.unmount()

    // While the board is off screen (e.g. in the lobby) its realtime
    // channel is not subscribed, so a room another player creates never
    // reaches this tab. The cache is younger than the 60 s staleTime, so it
    // would look fresh without being fresh.
    serverSquads.rooms = [...serverSquads.rooms, extraSquad]

    holdNextRoomsResponse = true
    const fetchesBeforeReturn = countHttpCalls('GET', '/api/rooms')
    const returningVisit = renderSquadsFlow('/squads', { queryClient })

    // The cached list paints while the mount GET is still in flight: the
    // page is not waiting on the request, so there is no skeleton and no
    // empty state.
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeReturn + 1))
    // The held request is still in flight while the cached rooms are on
    // screen — the page never fell back to the skeleton.
    expect(queryClient.getQueryState(['squads'])?.fetchStatus).toBe('fetching')
    expect(screen.queryByText('No squads yet')).not.toBeInTheDocument()

    releaseRoomsResponse?.()
    expect(await screen.findByText('Extra room')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeReturn + 1)

    returningVisit.unmount()
  })

  it('issues exactly one GET per mount', async () => {
    const queryClient = createTestQueryClient()
    const firstVisit = renderSquadsFlow('/squads', { queryClient })
    await screen.findByText('Ranked grind')
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(1))
    firstVisit.unmount()

    renderSquadsFlow('/squads', { queryClient })
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
    const firstVisit = renderSquadsFlow('/squads', { queryClient })
    await screen.findByText('Ranked grind')
    firstVisit.unmount()
    const fetchesBeforeReturn = countHttpCalls('GET', '/api/rooms')

    // `refreshSquads()` marks the cache stale while no board is mounted (as
    // a mutation does before navigating to the lobby); mounting must still
    // fetch exactly once.
    await queryClient.invalidateQueries({ queryKey: ['squads'] })
    renderSquadsFlow('/squads', { queryClient })
    await screen.findByText('Ranked grind')
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeReturn + 1))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeReturn + 1)
  })

  it('ignores the acknowledgement of its own subscription, staying at one GET', async () => {
    renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')
    openLatestWebSocket()

    vi.useFakeTimers()
    try {
      // The first `lobby_subscribed` only confirms the subscription of the
      // mount; the mount fetch already covers the list, so no refetch is due.
      sendFromServer({ type: 'lobby_subscribed', payload: { message: 'Subscribed' } })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SQUAD_BOARD_REFETCH_DEBOUNCE_MS)
      })
      expect(countHttpCalls('GET', '/api/rooms')).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('deduplicates the mount fetch under StrictMode', async () => {
    renderSquadsFlow('/squads', { strictMode: true })
    await screen.findByText('Ranked grind')
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(1))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(countHttpCalls('GET', '/api/rooms')).toBe(1)
  })
})

describe('squad board — join flows', () => {
  it('requires sign-in before a guest can join and defers to Discord', async () => {
    const { user } = renderSquadsFlow('/squads', { user: null })

    await user.click(await screen.findByText('Ranked grind'))

    expect(await screen.findByText('Sign in required')).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Continue with Discord' }))
    expect(authStore.signInSocialCalls[0]).toMatchObject({
      provider: 'discord',
      callbackURL: expect.stringContaining('/squads?join=ABC123'),
    })
  })

  it('joins as an authenticated user, refreshes the board and opens the lobby', async () => {
    registerLobbyRoutes()
    const { router, user } = renderSquadsFlow('/squads')

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

  it('auto-joins a squad from a shared ?join link and returns to the board', async () => {
    // Current behavior (recorded, not endorsed): after the authenticated
    // auto-join, the search-clear write in useAutoJoin lands on the board's
    // URL, so the user ends up back on the board even though the join POST
    // succeeded. In a production build the App Router discards the lobby
    // navigation that the join started before it commits. This harness commits
    // its navigation at once, which is why the lobby is briefly shown here.
    registerLobbyRoutes()
    const { router } = renderSquadsFlow('/squads?join=ABC123')

    await waitFor(() => expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1))
    expect(countHttpCalls('GET', `/api/rooms/${openSquad.code}`)).toBe(1)

    await waitFor(() => expect(router.history.location.pathname).toBe('/squads'))
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1)
  })

  it('opens a board URL with invalid parameters: they fall back, the valid ones and the auto-join stay', async () => {
    // The join stays pending so the URL still carries every parameter it was opened with.
    onHttp('POST', '/api/rooms/:code/join', () => new Promise<MockHttpResponse>(() => {}))
    const { router } = renderSquadsFlow(
      '/squads?filter=bogus&sort=sideways&page=0&language=pt-br&join=ABC123'
    )

    // The valid join is kept: the auto-join fires once for its code.
    await waitFor(() => expect(countHttpCalls('POST', '/api/rooms/ABC123/join')).toBe(1))
    expect(router.state.location.search).toEqual({ language: 'pt-br', join: 'ABC123' })

    // The valid language filters the board; the invalid filter, sort and page use their defaults.
    const titles = () =>
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    await waitFor(() => expect(titles()).toEqual(['Full lobby', 'Casual five stack']))
  })

  it('opens the lobby directly for squads the user already belongs to', async () => {
    registerLobbyRoutes()
    const { router, user } = renderSquadsFlow('/squads')

    await user.click(await screen.findByText('Casual five stack'))

    await waitFor(() => expect(router.history.location.pathname).toBe('/rooms/MEM111'))
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(0)
    expect(await screen.findByText('Casual five stack')).toBeInTheDocument()
  })

  it('shows a friendly toast and stays in the board when joining fails', async () => {
    onHttp('POST', '/api/rooms/:code/join', () =>
      httpError(409, { message: 'Room is full', error: 'ROOM_FULL' })
    )
    const { router, user } = renderSquadsFlow('/squads')

    await user.click(await screen.findByText('Ranked grind'))

    await waitFor(() => expect(toastStore.errorCalls[0]).toBe('This squad is already full.'))
    expect(router.history.location.pathname).toBe('/squads')
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
      const { router, user } = renderSquadsFlow('/squads')

      await user.click(await screen.findByText('Ranked grind'))

      await waitFor(() => expect(toastStore.errorCalls[0]).toBe(message))
      expect(router.history.location.pathname).toBe('/squads')
    }
  )
})

/** A client holding the squads and the games the server render would have prefetched. */
function seededClient(squads: RoomsResponse = boardSquads): QueryClient {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['squads'], squads)
  queryClient.setQueryData(['games'], boardGames)
  return queryClient
}

/** The search parameters of the harness location, read the way the board reads them. */
function locationParams(navigation: { history: { location: { search: string } } }) {
  return new URLSearchParams(navigation.history.location.search)
}

const SEARCH_PLACEHOLDER = 'Search by game or squad name...'
const TAG_PLACEHOLDER = 'filter by tag...'

describe('squad board — URL state', () => {
  // The refetch on mount answers with the same squads the seeded client holds, so the page does not move.
  beforeEach(() => {
    onHttp('GET', '/api/rooms', () => httpOk(squadsForPagination()))
  })

  // The inputs and the URL are read on real timers; the debounce is then timed on a fake clock.
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a page selected before the debounce deadline', async () => {
    const { user, navigation } = renderSquadsFlow('/squads', {
      queryClient: seededClient(squadsForPagination()),
    })

    await user.click(await screen.findByRole('button', { name: 'Go to page 2' }))
    expect(await screen.findByText('Page room 7')).toBeInTheDocument()

    vi.useFakeTimers()
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByText('Page room 7')).toBeInTheDocument()
    expect(locationParams(navigation).get('page')).toBe('2')
  })

  it('preserves the page from a shared URL with matching input values', async () => {
    const { navigation } = renderSquadsFlow('/squads?page=2&search=Ranked&tag=duo', {
      queryClient: seededClient(squadsForPagination()),
    })
    await screen.findByPlaceholderText(SEARCH_PLACEHOLDER)

    vi.useFakeTimers()
    act(() => vi.advanceTimersByTime(300))
    expect(locationParams(navigation).get('page')).toBe('2')
    expect(locationParams(navigation).get('search')).toBe('Ranked')
  })

  it.each([
    ['search', SEARCH_PLACEHOLDER],
    ['tag', TAG_PLACEHOLDER],
  ] as const)(
    'debounces an edited %s and resets the page only once',
    async (field, placeholder) => {
      const { navigation } = renderSquadsFlow('/squads?page=2', {
        queryClient: seededClient(squadsForPagination()),
      })
      const input = await screen.findByPlaceholderText(placeholder)

      vi.useFakeTimers()
      fireEvent.change(input, { target: { value: 'Ranked' } })
      act(() => vi.advanceTimersByTime(299))
      expect(locationParams(navigation).get(field)).toBeNull()
      expect(locationParams(navigation).get('page')).toBe('2')

      act(() => vi.advanceTimersByTime(1))
      expect(locationParams(navigation).get(field)).toBe('Ranked')
      expect(locationParams(navigation).get('page')).toBeNull()
    }
  )

  it('syncs URL navigation to both inputs without resetting its page', async () => {
    const { navigation } = renderSquadsFlow('/squads', {
      queryClient: seededClient(squadsForPagination()),
    })
    const search = await screen.findByPlaceholderText(SEARCH_PLACEHOLDER)

    vi.useFakeTimers()
    act(() => {
      navigation.history.push('/squads?search=Ranked&tag=duo&page=3')
    })
    expect(search).toHaveValue('Ranked')
    expect(screen.getByPlaceholderText(TAG_PLACEHOLDER)).toHaveValue('duo')

    act(() => vi.advanceTimersByTime(300))
    expect(locationParams(navigation).get('page')).toBe('3')
  })

  it('writes the page and the search to the URL without a navigation, so the list is not fetched again', async () => {
    const writeUrl = vi.spyOn(window.history, 'replaceState')
    const { user, navigation } = renderSquadsFlow('/squads', {
      queryClient: seededClient(squadsForPagination()),
    })
    await user.click(await screen.findByRole('button', { name: 'Go to page 2' }))
    expect(await screen.findByText('Page room 7')).toBeInTheDocument()
    const fetchesBeforeWrites = countHttpCalls('GET', '/api/rooms')
    expect(writeUrl).toHaveBeenLastCalledWith(null, '', '/squads?page=2')

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'Page room 7' },
    })
    await waitFor(() => expect(locationParams(navigation).get('search')).toBe('Page room 7'))
    expect(writeUrl).toHaveBeenLastCalledWith(null, '', '/squads?search=Page+room+7')

    // Both writes moved the URL the hooks read, and the router recorded no navigation for either.
    expect(navigation.calls).toEqual([])
    expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeWrites)
    writeUrl.mockRestore()
  })
})

describe('squad board — invite links', () => {
  it('does not auto-join a join value that is not a room code', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderSquadsFlow('/squads?join=..%2F..%2Fadmin', { queryClient: seededClient(boardSquads) })
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()

    // No request leaves with a method other than GET, whatever path the value would have built.
    const writes = fetchSpy.mock.calls.filter(
      ([, init]) => init?.method !== undefined && init.method !== 'GET'
    )
    expect(writes).toEqual([])
    fetchSpy.mockRestore()
  })
})

describe('squad board — seeded server page', () => {
  it('shows the page the URL asks for from the seeded data, and after a realtime update', async () => {
    const serverSquads = { rooms: [...squadsForPagination().rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverSquads))
    renderSquadsFlow('/squads?filter=has-space&page=2', {
      queryClient: seededClient(squadsForPagination()),
    })

    expect(await screen.findByText('Page room 7')).toBeInTheDocument()
    expect(screen.queryByText('Page room 1')).not.toBeInTheDocument()

    openLatestWebSocket()
    const fetchesBeforeUpdate = countHttpCalls('GET', '/api/rooms')
    const pageTwoSquad = squadsForPagination().rooms.find((squad) => squad.name === 'Page room 7')
    if (!pageTwoSquad) throw new Error('The pagination fixture has no page two squad')
    serverSquads.rooms = serverSquads.rooms.map((squad) =>
      squad.id === pageTwoSquad.id ? { ...squad, memberCount: 2 } : squad
    )
    sendFromServer({
      type: 'room_updated',
      payload: { roomId: pageTwoSquad.id, roomCode: pageTwoSquad.code, memberCount: 2 },
    })

    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesBeforeUpdate)
    )
    // The event only schedules a refetch and does not patch the cache, so the squad's new count shows once the refetch is applied.
    const pageTwoCard = () => screen.getByText('Page room 7').closest('button')
    await waitFor(() => expect(pageTwoCard()).toHaveTextContent('2/5'))
    expect(screen.getByText('Page room 7')).toBeInTheDocument()
    expect(screen.queryByText('Page room 1')).not.toBeInTheDocument()
  })
})
