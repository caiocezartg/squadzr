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
import { squadQueryKey } from '@/features/lobby/squad-details'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import {
  boardSquads,
  fullSquad,
  gameLol,
  gameLolSummary,
  guestPlayer,
  hostPlayer,
  lobbySquad,
  lobbySquadResponse,
  memberSquad,
  openSquad,
  squadReadyNotification,
  squadsForPagination,
} from './fixtures'
import { authStore, toastStore } from './stubs'
import { openLatestWebSocket, sendFromServer, serverSentFrames } from './ws-flows'
import { MockWebSocket } from './ws-mock'
import { mockMediaQuery } from './media-query'
import { NARROW_QUERY } from '@/components/ds/use-media-query'
import type { JoinRoomResponse } from '@squadzr/schemas'
import type { RoomsResponse, Squad } from '@/types'

/** The listed Squads' names in grid order, read from the cards' accessible names ("name — game, …"). */
function listedSquadNames(): string[] {
  const grid = document.getElementById('squads-grid')
  if (!grid) throw new Error('The squad grid is not on the page')
  return within(grid)
    .getAllByLabelText(/ — /)
    .map((card) => (card.getAttribute('aria-label') ?? '').split(' — ')[0] ?? '')
}

const joinSquadResponse: JoinRoomResponse = {
  message: 'Joined squad',
  roomMember: {
    id: 'bbbbbbbb-0000-4000-8000-000000000001',
    roomId: openSquad.id,
    userId: 'user-1',
    joinedAt: new Date().toISOString(),
  },
}

const extraSquad: Squad = {
  id: 'aaaaaaaa-0000-4000-8000-00000000000a',
  code: 'EXTR01',
  name: 'Extra squad',
  hostId: 'user-9',
  gameId: gameLol.id,
  game: gameLolSummary,
  maxPlayers: 5,
  discordLink: null,
  tags: [],
  language: 'en',
  memberCount: 1,
  memberPreview: [{ id: 'user-9', name: 'Mia', image: null }],
  isMember: false,
  createdAt: new Date(Date.now() - 300_000).toISOString(),
  updatedAt: new Date(Date.now() - 300_000).toISOString(),
}

function registerBoardRoutes(): void {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
}

function registerLobbyRoutes(): void {
  onHttp('GET', '/api/rooms/:code', (req) => {
    if (req.params.code === openSquad.code) return httpOk(lobbySquadResponse)
    if (req.params.code === memberSquad.code) {
      return httpOk({ room: memberSquad, players: [guestPlayer, hostPlayer] })
    }
    return httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
  })
  onHttp('POST', '/api/rooms/:code/join', () => httpOk(joinSquadResponse))
}

beforeEach(() => {
  registerBoardRoutes()
})

describe('squad board — rendering', () => {
  it('renders every squad with its game, member count and join state', async () => {
    renderSquadsFlow('/squads')

    const open = await screen.findByRole('button', {
      name: 'Ranked grind — League of Legends, EN-US, 1 of 5 players',
    })
    expect(within(open).getByRole('img', { name: 'League of Legends' })).toHaveAttribute(
      'src',
      openSquad.game.coverUrl
    )

    const full = screen.getByRole('button', {
      name: 'Full lobby — Counter-Strike 2, PT-BR, 4 of 4 players',
    })
    expect(full).toHaveAttribute('aria-disabled', 'true')
    expect(within(full).getByRole('img', { name: 'Counter-Strike 2' })).toHaveAttribute(
      'src',
      fullSquad.game.coverUrl
    )

    const joined = screen.getByRole('link', {
      name: 'Casual five stack — League of Legends, PT-BR, 3 of 4 players',
    })
    expect(joined).toHaveAttribute('href', '/squads/MEM111')
    expect(within(joined).getByText('Joined')).toBeInTheDocument()
    expect(screen.getByText('3 open squads')).toBeInTheDocument()
  })

  it('shows the empty state without a create action for guests', async () => {
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: [] }))
    renderSquadsFlow('/squads', { user: null, shell: true })

    expect(await screen.findByText('No squads yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create Squad' })).not.toBeInTheDocument()
  })

  it('offers a signed-in player a create action in the empty state', async () => {
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: [] }))
    const { user } = renderSquadsFlow('/squads', { shell: true })

    expect(await screen.findByText('No squads yet')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Create Squad' }).at(-1)!)

    expect(await screen.findByText('Create a Squad', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('shows the inline load error when the board request fails', async () => {
    onHttp('GET', '/api/rooms', () => httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' }))
    renderSquadsFlow('/squads')

    expect(
      await screen.findByText('Failed to load squads. Please refresh the page.')
    ).toBeInTheDocument()
  })
})

const SEARCH_PLACEHOLDER = 'Search by game or squad name…'

/** Opens the filters panel from the bar's button and returns the panel. */
async function openFilters(user: ReturnType<typeof renderSquadsFlow>['user']) {
  await user.click(await screen.findByRole('button', { name: /^Filters/ }))
  return screen.findByRole('dialog', { name: 'Filters' })
}

/** The URL's `tag` values, in order. */
function urlTags(navigation: { history: { location: { search: string } } }): string[] {
  return new URLSearchParams(navigation.history.location.search).getAll('tag')
}

describe('squad board — filters', () => {
  it('filters squads by debounced search term', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')

    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'Ranked')

    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByText('Casual five stack')).not.toBeInTheDocument()
  })

  it('filters squads by the game name their own summary carries', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')

    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'Counter')

    await waitFor(() => expect(screen.queryByText('Ranked grind')).not.toBeInTheDocument())
    expect(screen.getByText('Full lobby')).toBeInTheDocument()
    expect(screen.queryByText('Casual five stack')).not.toBeInTheDocument()
  })

  it('filters squads by availability, live, with a chip for each', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')
    const panel = await openFilters(user)

    await user.click(within(panel).getByRole('button', { name: 'With space' }))
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.getByText('Casual five stack')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove With space' })).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: 'Almost full' }))
    await waitFor(() => expect(screen.queryByText('Ranked grind')).not.toBeInTheDocument())
    expect(screen.getByText('Casual five stack')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove With space' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Almost full' })).toBeInTheDocument()
  })

  it('filters squads by language', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')
    const panel = await openFilters(user)

    await user.click(within(panel).getByRole('button', { name: 'EN-US' }))

    await waitFor(() => expect(screen.queryByText('Casual five stack')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByText('Full lobby')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove EN-US' })).toBeInTheDocument()
  })

  it('sorts squads by creation date', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')

    expect(listedSquadNames()).toEqual(['Ranked grind', 'Full lobby', 'Casual five stack'])

    const panel = await openFilters(user)
    await user.click(within(panel).getByRole('button', { name: 'Oldest' }))
    await waitFor(() =>
      expect(listedSquadNames()).toEqual(['Casual five stack', 'Full lobby', 'Ranked grind'])
    )
  })

  it('lists the most used tags as toggles, and keeps a squad only when it has every selected tag', async () => {
    const { user, navigation } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')
    const panel = await openFilters(user)
    const toggles = within(within(panel).getByRole('group', { name: 'Tags' })).getAllByRole(
      'button'
    )
    expect(toggles.map((toggle) => toggle.textContent)).toEqual(['#chill', '#ranked'])

    await user.click(toggles[0]!)
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.getByText('Casual five stack')).toBeInTheDocument()

    await user.click(toggles[1]!)
    await waitFor(() => expect(screen.queryByText('Casual five stack')).not.toBeInTheDocument())
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(urlTags(navigation)).toEqual(['chill', 'ranked'])
    expect(screen.getByRole('button', { name: 'Remove #chill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove #ranked' })).toBeInTheDocument()
  })

  it('selects a typed tag, keeps it as a toggle and compares it exactly', async () => {
    const { user, navigation } = renderSquadsFlow('/squads', { shell: true })
    await screen.findByText('Ranked grind')
    const panel = await openFilters(user)
    const field = within(panel).getByRole('textbox', { name: 'Add a tag' })

    await user.type(field, 'rank{Enter}')
    await waitFor(() => expect(urlTags(navigation)).toEqual(['rank']))
    expect(field).toHaveValue('')
    expect(screen.getByText('No squads found')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: '#rank', pressed: true })).toBeInTheDocument()

    await user.type(field, '#Mic,')
    await waitFor(() => expect(urlTags(navigation)).toEqual(['rank', 'mic']))
  })

  it('shows the live result count on the main button, which closes the panel', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')
    const panel = await openFilters(user)
    expect(within(panel).getByRole('button', { name: 'Show 3 squads' })).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: '#ranked' }))
    await user.click(await within(panel).findByRole('button', { name: 'Show 1 squad' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(listedSquadNames()).toEqual(['Ranked grind'])
  })

  it('counts the active filters on the button, and inverts it while the panel is open', async () => {
    const { user } = renderSquadsFlow('/squads?language=en&tag=chill')
    const button = await screen.findByRole('button', { name: /^Filters/ })
    expect(button).toHaveTextContent('2')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveClass('bg-raised-2')

    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveClass('bg-text')
  })

  it('removes a filter with its chip, and every filter with "Clear"', async () => {
    const { user, navigation } = renderSquadsFlow('/squads?language=en&filter=has-space&tag=chill')
    await screen.findByText('Ranked grind')
    expect(listedSquadNames()).toEqual(['Ranked grind'])

    await user.click(screen.getByRole('button', { name: 'Remove #chill' }))
    expect(urlTags(navigation)).toEqual([])
    expect(screen.queryByRole('button', { name: 'Remove #chill' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove EN-US' }))
    await waitFor(() => expect(listedSquadNames()).toEqual(['Ranked grind', 'Casual five stack']))

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(listedSquadNames()).toHaveLength(3))
    expect(navigation.history.location.search).toBe('')
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })

  it('puts every control back with "Clear all", and leaves the search as it is', async () => {
    const { user, navigation } = renderSquadsFlow(
      '/squads?search=a&language=pt-br&sort=oldest&tag=chill'
    )
    await screen.findByText('Casual five stack')
    const panel = await openFilters(user)

    await user.click(within(panel).getByRole('button', { name: 'Clear all' }))

    await waitFor(() => expect(navigation.history.location.search).toBe('?search=a'))
    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toHaveValue('a')
  })

  it('reads a legacy single ?tag=x as one tag, and several as a list', async () => {
    const { navigation } = renderSquadsFlow('/squads?tag=chill')
    await screen.findByText('Ranked grind')
    expect(screen.getByRole('button', { name: 'Remove #chill' })).toBeInTheDocument()
    expect(listedSquadNames()).toEqual(['Ranked grind', 'Casual five stack'])

    act(() => navigation.history.push('/squads?tag=chill&tag=ranked'))

    await waitFor(() => expect(listedSquadNames()).toEqual(['Ranked grind']))
    expect(screen.getByRole('button', { name: 'Remove #ranked' })).toBeInTheDocument()
  })

  it.each([
    ['while the list is loading', () => new Promise<MockHttpResponse>(() => {})],
    [
      'when the list failed to load',
      () => httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' }),
    ],
  ])('opens the panel with its controls %s', async (_when, answer) => {
    onHttp('GET', '/api/rooms', answer)
    const { user } = renderSquadsFlow('/squads')

    const panel = await openFilters(user)

    expect(within(panel).getByRole('button', { name: 'Show squads' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Oldest' })).toBeInTheDocument()
    expect(within(panel).getByRole('textbox', { name: 'Add a tag' })).toBeInTheDocument()
  })

  it('empties the typed tag text with "Clear all"', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')
    const panel = await openFilters(user)
    const field = within(panel).getByRole('textbox', { name: 'Add a tag' })

    await user.type(field, 'half')
    await user.click(within(panel).getByRole('button', { name: 'Clear all' }))

    expect(field).toHaveValue('')
  })

  it('opens the filters as a bottom sheet below 640px', async () => {
    mockMediaQuery(NARROW_QUERY, true)
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')

    const panel = await openFilters(user)

    expect(panel.className).toContain('inset-x-0')
    expect(panel.className).toContain('bottom-0')
    // The sheet spans the screen: the popover's width applies from 640px up only.
    expect(panel.className.split(' ')).not.toContain('w-105')
    expect(panel.className).toContain('sm:w-105')
    expect(within(panel).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Show 3 squads' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('squad board — pagination', () => {
  it('paginates the squad grid across pages', async () => {
    onHttp('GET', '/api/rooms', () => httpOk(squadsForPagination()))
    const { user } = renderSquadsFlow('/squads')

    expect(await screen.findByText('Page squad 1')).toBeInTheDocument()
    expect(screen.queryByText('Page squad 7')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Page 2' }))

    expect(await screen.findByText('Page squad 7')).toBeInTheDocument()
    expect(screen.queryByText('Page squad 1')).not.toBeInTheDocument()
  })
})

describe('squad board — page changes and grid', () => {
  it('scrolls the new page to the start of the list, smoothly', async () => {
    onHttp('GET', '/api/rooms', () => httpOk(squadsForPagination()))
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Page squad 1')
    scroll.mockClear()

    await user.click(screen.getByRole('button', { name: 'Page 2' }))

    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('squads-grid'))
    expect(screen.getByText('Page squad 7')).toBeInTheDocument()
  })

  it('scrolls at once when the viewer prefers reduced motion', async () => {
    onHttp('GET', '/api/rooms', () => httpOk(squadsForPagination()))
    mockMediaQuery('(prefers-reduced-motion: reduce)', true)
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Page squad 1')
    scroll.mockClear()

    await user.click(screen.getByRole('button', { name: 'Page 2' }))

    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' }))
  })

  it('does not scroll when the viewer stays on the current page', async () => {
    onHttp('GET', '/api/rooms', () => httpOk(squadsForPagination()))
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Page squad 1')
    scroll.mockClear()

    await user.click(screen.getByRole('button', { name: 'Page 1' }))

    expect(scroll).not.toHaveBeenCalled()
  })

  it('lays two cards in a row only when the grid itself is wide enough for them', async () => {
    renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')

    const list = document.getElementById('squads-grid')!
    expect(list).toHaveClass('@container')
    const columns = list.firstElementChild!
    expect(columns).toHaveClass('grid-cols-1', '@4xl:grid-cols-2')
    expect(columns.className).not.toMatch(/(^| )(sm|md|lg|xl):grid-cols-2/)
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

    // The server creates a squad; the event refetches the authoritative list.
    // Duplicate events stay idempotent: the squad renders and caches once.
    const fetchesBeforeCreate = countHttpCalls('GET', '/api/rooms')
    serverSquads.rooms = [...serverSquads.rooms, extraSquad]
    sendFromServer({ type: 'room_created', payload: { room: extraSquad } })
    sendFromServer({ type: 'room_created', payload: { room: extraSquad } })
    expect(await screen.findByText('Extra squad')).toBeInTheDocument()
    expect(screen.getAllByText('Extra squad')).toHaveLength(1)
    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesBeforeCreate)
    )
    const cachedAfterCreate = queryClient.getQueryData<RoomsResponse>(['squads'])
    expect(cachedAfterCreate?.rooms.filter((squad) => squad.id === extraSquad.id)).toHaveLength(1)

    // A Membership change refetches the new count instead of patching it in.
    serverSquads.rooms = serverSquads.rooms.map((squad) =>
      squad.id === openSquad.id ? { ...squad, memberCount: 3 } : squad
    )
    sendFromServer({
      type: 'room_updated',
      payload: { roomId: openSquad.id, roomCode: openSquad.code, memberCount: 3 },
    })
    sendFromServer({
      type: 'room_updated',
      payload: { roomId: openSquad.id, roomCode: openSquad.code, memberCount: 3 },
    })
    // The count renders as `<span>3</span>/5` - assert within the squad card.
    const openCard = screen.getByText('Ranked grind').closest('button')
    expect(openCard).not.toBeNull()
    await waitFor(() =>
      expect(within(openCard as HTMLElement).getByText('3', { exact: true })).toBeInTheDocument()
    )

    // A Ready/expired squad leaves the server list; the event refetches the
    // board until the squad is gone.
    serverSquads.rooms = serverSquads.rooms.filter((squad) => squad.id !== fullSquad.id)
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
    expect(cachedAfterDelete?.rooms.some((squad) => squad.id === fullSquad.id)).toBe(false)
  })

  it('drops a Ready squad through authoritative state and never resurrects it from a late room_created', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverSquads))
    const { queryClient } = renderSquadsFlow('/squads')
    await screen.findByText('Full lobby')

    openLatestWebSocket()

    // The squad becomes Ready: the server drops it from the board list and
    // announces room_removed without waiting for any polling.
    serverSquads.rooms = serverSquads.rooms.filter((squad) => squad.id !== fullSquad.id)
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: fullSquad.id, roomCode: fullSquad.code },
    })
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    const fetchesAfterRemoval = countHttpCalls('GET', '/api/rooms')

    // A late room_created for the same squad must not patch it back into the
    // cache: the event schedules the authoritative refetch, and the server
    // list no longer has the squad.
    const cachedSquadIds = () =>
      queryClient.getQueryData<RoomsResponse>(['squads'])?.rooms.map((squad) => squad.id) ?? []
    sendFromServer({ type: 'room_created', payload: { room: fullSquad } })
    expect(cachedSquadIds()).not.toContain(fullSquad.id)

    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesAfterRemoval)
    )
    await waitFor(() => expect(screen.queryByText('Full lobby')).not.toBeInTheDocument())
    expect(cachedSquadIds()).not.toContain(fullSquad.id)
  })

  it('applies a pushed notification to the notifications cache without duplicating it', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['notifications', { limit: 10 }], { notifications: [] })
    renderSquadsFlow('/squads', { queryClient })
    await screen.findByText('Ranked grind')

    openLatestWebSocket()
    sendFromServer({
      type: 'notification',
      payload: { notification: squadReadyNotification },
    })

    await waitFor(() =>
      expect(
        queryClient.getQueryData<{ notifications: unknown[] }>(['notifications', { limit: 10 }])
          ?.notifications
      ).toHaveLength(1)
    )

    sendFromServer({
      type: 'notification',
      payload: { notification: squadReadyNotification },
    })
    expect(
      queryClient.getQueryData<{ notifications: unknown[] }>(['notifications', { limit: 10 }])
        ?.notifications
    ).toHaveLength(1)
  })

  it('clips the pushed notification to the limit of each notifications query', async () => {
    const olderNotification = {
      ...squadReadyNotification,
      id: '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6c',
      title: 'Older notification',
    }
    const pushedNotification = {
      ...squadReadyNotification,
      id: '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6d',
      title: 'Pushed notification',
    }
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['notifications', { limit: 2 }], {
      notifications: [squadReadyNotification, olderNotification],
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
        expect.objectContaining({ id: squadReadyNotification.id }),
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

      // ...while a removed squad leaves the screen on the event itself, before
      // the coalesced refetch lands.
      serverSquads.rooms = serverSquads.rooms.filter((squad) => squad.id !== fullSquad.id)
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
          ?.rooms.some((squad) => squad.id === fullSquad.id)
      ).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('squad board — removal without cached squads', () => {
  it('fetches the board when a directly opened lobby squad is deleted', async () => {
    const remainingSquads = boardSquads.rooms.filter((squad) => squad.id !== lobbySquad.id)
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: remainingSquads }))
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))

    const { navigation } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    // The squad leaves the board while the board query was never loaded.
    sendFromServer({
      type: 'room_deleted',
      payload: { roomId: lobbySquad.id, roomCode: lobbySquad.code },
    })

    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads'))
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
      // flight still carries the squad the removal will drop.
      const staleSquads = { rooms: [...serverSquads.rooms] }
      return new Promise<MockHttpResponse>((resolve) => {
        releaseHeldResponse = () => resolve(httpOk(staleSquads))
      })
    })

    const { queryClient } = renderSquadsFlow('/squads')
    await screen.findByText('Full lobby')
    openLatestWebSocket()

    vi.useFakeTimers()
    try {
      // A coalesced refetch starts while the server still lists the squad; its
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

      // The squad leaves the board while the fetch is pending.
      serverSquads.rooms = serverSquads.rooms.filter((squad) => squad.id !== fullSquad.id)
      sendFromServer({
        type: 'room_removed',
        payload: { roomId: fullSquad.id, roomCode: fullSquad.code },
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.queryByText('Full lobby')).not.toBeInTheDocument()

      // The pre-removal response lands and must not resurrect the squad.
      releaseHeldResponse?.()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.queryByText('Full lobby')).not.toBeInTheDocument()
      expect(
        queryClient
          .getQueryData<RoomsResponse>(['squads'])
          ?.rooms.some((squad) => squad.id === fullSquad.id)
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
    expect(await screen.findByText('Extra squad')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBefore + 1)
  })
})

describe('squad board — refetch on mount', () => {
  it('re-reads on mount and surfaces a squad created while the user was away', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    let holdNextSquadsResponse = false
    let releaseSquadsResponse: (() => void) | undefined
    onHttp('GET', '/api/rooms', () => {
      if (!holdNextSquadsResponse) return httpOk({ rooms: [...serverSquads.rooms] })
      const responseSquads = { rooms: [...serverSquads.rooms] }
      return new Promise<MockHttpResponse>((resolve) => {
        releaseSquadsResponse = () => resolve(httpOk(responseSquads))
      })
    })

    const queryClient = createTestQueryClient()
    const firstVisit = renderSquadsFlow('/squads', { queryClient })
    await screen.findByText('Ranked grind')
    firstVisit.unmount()

    // While the board is off screen (e.g. in the lobby) its realtime
    // channel is not subscribed, so a squad another player creates never
    // reaches this tab. The cache is younger than the 60 s staleTime, so it
    // would look fresh without being fresh.
    serverSquads.rooms = [...serverSquads.rooms, extraSquad]

    holdNextSquadsResponse = true
    const fetchesBeforeReturn = countHttpCalls('GET', '/api/rooms')
    const returningVisit = renderSquadsFlow('/squads', { queryClient })

    // The cached list paints while the mount GET is still in flight: the
    // page is not waiting on the request, so there is no skeleton and no
    // empty state.
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeReturn + 1))
    // The held request is still in flight while the cached squads are on
    // screen — the page never fell back to the skeleton.
    expect(queryClient.getQueryState(['squads'])?.fetchStatus).toBe('fetching')
    expect(screen.queryByText('No squads yet')).not.toBeInTheDocument()

    releaseSquadsResponse?.()
    expect(await screen.findByText('Extra squad')).toBeInTheDocument()
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
        await vi.advanceTimersByTimeAsync(300)
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
    const { navigation, user } = renderSquadsFlow('/squads')

    await user.click(await screen.findByText('Ranked grind'))

    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads/ABC123'))
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
    // The search-clear write in useAutoJoin lands on the board's URL while the lobby navigation is
    // still in flight, so the navigation is discarded and the user stays on the board even though the
    // join POST succeeded.
    registerLobbyRoutes()
    const { navigation } = renderSquadsFlow('/squads?join=ABC123')

    await waitFor(() => expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1))

    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads'))
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1)
  })

  it('opens a board URL with invalid parameters: they fall back, the valid ones and the auto-join stay', async () => {
    // The join stays pending so the URL still carries every parameter it was opened with.
    onHttp('POST', '/api/rooms/:code/join', () => new Promise<MockHttpResponse>(() => {}))
    const { navigation } = renderSquadsFlow(
      '/squads?filter=bogus&sort=sideways&page=0&language=pt-br&join=ABC123'
    )

    // The valid join is kept: the auto-join fires once for its code.
    await waitFor(() => expect(countHttpCalls('POST', '/api/rooms/ABC123/join')).toBe(1))
    const params = new URLSearchParams(navigation.history.location.search)
    expect(params.get('language')).toBe('pt-br')
    expect(params.get('join')).toBe('ABC123')

    // The valid language filters the board; the invalid filter, sort and page use their defaults.
    await waitFor(() => expect(listedSquadNames()).toEqual(['Full lobby', 'Casual five stack']))
  })

  it('opens the lobby directly for squads the user already belongs to', async () => {
    registerLobbyRoutes()
    const { navigation, user } = renderSquadsFlow('/squads')

    await user.click(await screen.findByText('Casual five stack'))

    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads/MEM111'))
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(0)
    expect(await screen.findByText('Casual five stack')).toBeInTheDocument()
  })

  it('shows a friendly toast and stays in the board when joining fails', async () => {
    onHttp('POST', '/api/rooms/:code/join', () =>
      httpError(409, { message: 'Room is full', error: 'ROOM_FULL' })
    )
    const { navigation, user } = renderSquadsFlow('/squads')

    await user.click(await screen.findByText('Ranked grind'))

    await waitFor(() => expect(toastStore.errorCalls[0]).toBe('This squad is already full.'))
    expect(navigation.history.location.pathname).toBe('/squads')
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
      const { navigation, user } = renderSquadsFlow('/squads')

      await user.click(await screen.findByText('Ranked grind'))

      await waitFor(() => expect(toastStore.errorCalls[0]).toBe(message))
      expect(navigation.history.location.pathname).toBe('/squads')
    }
  )
})

/** A client holding the squads the server render would have prefetched. */
function seededClient(squads: RoomsResponse = boardSquads): QueryClient {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['squads'], squads)
  return queryClient
}

/** The search parameters of the harness location, read the way the board reads them. */
function locationParams(navigation: { history: { location: { search: string } } }) {
  return new URLSearchParams(navigation.history.location.search)
}

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

    await user.click(await screen.findByRole('button', { name: 'Page 2' }))
    expect(await screen.findByText('Page squad 7')).toBeInTheDocument()

    vi.useFakeTimers()
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByText('Page squad 7')).toBeInTheDocument()
    expect(locationParams(navigation).get('page')).toBe('2')
  })

  it('preserves the page from a shared URL with matching input values', async () => {
    const { navigation } = renderSquadsFlow('/squads?page=2&search=Ranked&tag=duo', {
      shell: true,
      queryClient: seededClient(squadsForPagination()),
    })
    await screen.findByPlaceholderText(SEARCH_PLACEHOLDER)

    vi.useFakeTimers()
    act(() => vi.advanceTimersByTime(300))
    expect(locationParams(navigation).get('page')).toBe('2')
    expect(locationParams(navigation).get('search')).toBe('Ranked')
  })

  it('debounces an edited search and resets the page only once', async () => {
    const { navigation } = renderSquadsFlow('/squads?page=2', {
      shell: true,
      queryClient: seededClient(squadsForPagination()),
    })
    const input = await screen.findByPlaceholderText(SEARCH_PLACEHOLDER)

    vi.useFakeTimers()
    fireEvent.change(input, { target: { value: 'Ranked' } })
    act(() => vi.advanceTimersByTime(299))
    expect(locationParams(navigation).get('search')).toBeNull()
    expect(locationParams(navigation).get('page')).toBe('2')

    act(() => vi.advanceTimersByTime(1))
    expect(locationParams(navigation).get('search')).toBe('Ranked')
    expect(locationParams(navigation).get('page')).toBeNull()
  })

  it('syncs URL navigation to the search and the tag chips without resetting its page', async () => {
    const { navigation } = renderSquadsFlow('/squads', {
      shell: true,
      queryClient: seededClient(squadsForPagination()),
    })
    const search = await screen.findByPlaceholderText(SEARCH_PLACEHOLDER)

    vi.useFakeTimers()
    act(() => {
      navigation.history.push('/squads?search=Ranked&tag=duo&page=3')
    })
    expect(search).toHaveValue('Ranked')
    expect(screen.getByRole('button', { name: 'Remove #duo' })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(300))
    expect(locationParams(navigation).get('page')).toBe('3')
  })

  it('writes the page and the search to the URL without a navigation, so the list is not fetched again', async () => {
    const writeUrl = vi.spyOn(window.history, 'replaceState')
    const { user, navigation } = renderSquadsFlow('/squads', {
      queryClient: seededClient(squadsForPagination()),
    })
    await user.click(await screen.findByRole('button', { name: 'Page 2' }))
    expect(await screen.findByText('Page squad 7')).toBeInTheDocument()
    const fetchesBeforeWrites = countHttpCalls('GET', '/api/rooms')
    expect(writeUrl).toHaveBeenLastCalledWith(null, '', '/squads?page=2')

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'Page squad 7' },
    })
    await waitFor(() => expect(locationParams(navigation).get('search')).toBe('Page squad 7'))
    expect(writeUrl).toHaveBeenLastCalledWith(null, '', '/squads?search=Page+squad+7')

    // Both writes moved the URL the hooks read, and the router recorded no navigation for either.
    expect(navigation.calls).toEqual([])
    expect(countHttpCalls('GET', '/api/rooms')).toBe(fetchesBeforeWrites)
    writeUrl.mockRestore()
  })
})

describe('squad board — invite links', () => {
  it('does not auto-join a join value that is not a squad code', async () => {
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

    expect(await screen.findByText('Page squad 7')).toBeInTheDocument()
    expect(screen.queryByText('Page squad 1')).not.toBeInTheDocument()

    openLatestWebSocket()
    const fetchesBeforeUpdate = countHttpCalls('GET', '/api/rooms')
    const pageTwoSquad = squadsForPagination().rooms.find((squad) => squad.name === 'Page squad 7')
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
    const pageTwoCard = () => screen.getByText('Page squad 7').closest('button')
    await waitFor(() => expect(pageTwoCard()).toHaveTextContent('2/5'))
    expect(screen.getByText('Page squad 7')).toBeInTheDocument()
    expect(screen.queryByText('Page squad 1')).not.toBeInTheDocument()
  })
})

describe('squad board — warm cache across surfaces', () => {
  it('navigates from the board to My Squads and to a Lobby with no loading state', async () => {
    onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))
    // Registered last, so it wins over the `/api/rooms/:code` route above for this path.
    onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [memberSquad], joined: [] }))
    const queryClient = createTestQueryClient()
    // What the three routes' server reads have already dehydrated on a warm navigation.
    queryClient.setQueryData(['squads'], boardSquads)
    queryClient.setQueryData(['my-squads'], { hosted: [memberSquad], joined: [] })
    queryClient.setQueryData(squadQueryKey(lobbySquad.code), lobbySquadResponse)

    const { navigation } = renderSquadsFlow('/squads', { queryClient })

    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByTestId('squad-board-skeleton')).not.toBeInTheDocument()

    act(() => navigation.history.push('/squads/my'))
    // The push commits synchronously, so a fallback would be in the DOM here if the cache missed.
    expect(screen.queryByTestId('my-squads-skeleton')).not.toBeInTheDocument()
    expect(await screen.findByText('Casual five stack')).toBeInTheDocument()
    expect(screen.queryByTestId('my-squads-skeleton')).not.toBeInTheDocument()

    act(() => navigation.history.push(`/squads/${lobbySquad.code}`))
    expect(screen.queryByTestId('lobby-skeleton')).not.toBeInTheDocument()
    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    expect(screen.queryByTestId('lobby-skeleton')).not.toBeInTheDocument()
    expect(screen.getByText(lobbySquad.game.name)).toBeInTheDocument()
  })
})
