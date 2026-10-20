/**
 * Characterization tests for the create-room flow on the Squad Board page
 * and on My Squads (`/squads/my`).
 *
 * Covers the gating of the create button by session state, client-side
 * validation of the form, the payload posted to the API on success (including
 * navigation to the created lobby), the board refresh shared by both entry
 * points and the error presentation when the server rejects the creation.
 *
 * HTTP runs through the deterministic adapter (./http-router); auth and
 * toasts are module mocks (./stubs). No test touches private hook state.
 */

import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderSquadsFlow } from './harness'
import { countHttpCalls, getHttpLog, httpCreated, httpError, httpOk, onHttp } from './http-router'
import {
  boardGames,
  boardSquads,
  createRoomResponse,
  createdSquad,
  gameLol,
  hostPlayer,
} from './fixtures'
import { toastStore } from './stubs'
import type { MyRoomsResponse } from '@/types'

function registerBoardRoutes(): void {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/games', () => httpOk(boardGames))
}

function registerCreateRoutes(): void {
  onHttp('POST', '/api/rooms', () => httpCreated(createRoomResponse))
  onHttp('GET', '/api/rooms/:code', () =>
    httpOk({
      room: createdSquad,
      players: [hostPlayer],
    })
  )
  onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
}

beforeEach(() => {
  registerBoardRoutes()
})

async function openCreateModal(
  user: Awaited<ReturnType<typeof renderSquadsFlow>['user']>
): Promise<void> {
  await user.click(await screen.findByText('Create new squad'))
  await screen.findByText('Create a Squad', {}, { timeout: 5000 })
}

describe('create squad — entry point', () => {
  it('shows the create button only for signed-in users', async () => {
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)
  })

  it('hides the create button for guests', async () => {
    renderSquadsFlow('/squads', { user: null })
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByText('Create new squad')).not.toBeInTheDocument()
  })
})

describe('create squad — client validation', () => {
  it('blocks submission and shows field errors for an empty form', async () => {
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    expect(await screen.findByText('Squad name is required')).toBeInTheDocument()
    expect(screen.getByText('Please select a game')).toBeInTheDocument()
    expect(screen.getByText('Please enter a valid URL')).toBeInTheDocument()
    expect(countHttpCalls('POST', '/api/rooms')).toBe(0)
  })
})

describe('create squad — success flow', () => {
  it('posts the form payload and opens the created lobby', async () => {
    registerCreateRoutes()
    const { router, user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await user.click(screen.getByLabelText('Game'))
    await user.click(await screen.findByText('League of Legends (1-5 players)'))
    expect(
      await screen.findByText('Leave empty to use 5 players (League of Legends default).')
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')
    const tagInput = screen.getByPlaceholderText('Type a tag...')
    await user.type(tagInput, 'ranked,')
    await user.type(tagInput, 'flex')
    await user.keyboard('{Enter}')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() => {
      const post = getHttpLog().find((req) => req.method === 'POST' && req.path === '/api/rooms')
      expect(post).toBeDefined()
      expect(post?.body).toMatchObject({
        name: 'Created squad',
        gameId: gameLol.id,
        discordLink: 'https://discord.gg/created',
        tags: ['ranked', 'flex'],
        language: 'pt-br',
      })
    })

    await waitFor(() =>
      expect(router.history.location.pathname).toBe(`/squads/${createdSquad.code}`)
    )
    expect(screen.getByText('Created squad')).toBeInTheDocument()
  })
})

describe('create squad — returning to the board', () => {
  it('shows the created squad after the lobby and re-reads the board', async () => {
    registerCreateRoutes()
    const serverRooms = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: serverRooms.rooms }))
    const { router, user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await user.click(screen.getByLabelText('Game'))
    await user.click(await screen.findByText('League of Legends (1-5 players)'))
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')

    // The server lists the room as soon as it exists.
    serverRooms.rooms = [...serverRooms.rooms, createdSquad]
    const fetchesBeforeCreate = countHttpCalls('GET', '/api/rooms')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))
    await waitFor(() =>
      expect(router.history.location.pathname).toBe(`/squads/${createdSquad.code}`)
    )

    // The create flow refreshes the board before it navigates to the lobby.
    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesBeforeCreate)
    )

    await router.navigate({ href: '/squads' })
    expect(await screen.findByText('Created squad')).toBeInTheDocument()
  })
})

describe('create squad — from my squads', () => {
  it('refreshes the board so the new squad appears when returning to it', async () => {
    const serverRooms = { rooms: [...boardSquads.rooms] }
    const myRooms: MyRoomsResponse = { hosted: [], joined: [] }
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: serverRooms.rooms }))
    registerCreateRoutes()
    // Registered after the lobby route so the exact segment wins over `:code`.
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms))
    const { router, user } = renderSquadsFlow('/squads')

    // The board is loaded and fresh when the user leaves for My Squads.
    await screen.findByText('Ranked grind')
    await router.navigate({ href: '/squads/my' })
    await screen.findByText('My squads')

    // The server lists the new room in both lists as soon as it exists.
    serverRooms.rooms = [...serverRooms.rooms, createdSquad]
    myRooms.hosted = [createdSquad]
    const fetchesBeforeCreate = countHttpCalls('GET', '/api/rooms')

    await user.click(screen.getByRole('button', { name: 'Create new squad' }))
    await screen.findByText('Create a Squad', {}, { timeout: 5000 })
    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await user.click(screen.getByLabelText('Game'))
    await user.click(await screen.findByText('League of Legends (1-5 players)'))
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')
    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() =>
      expect(router.history.location.pathname).toBe(`/squads/${createdSquad.code}`)
    )

    // The create capability asked the board to refresh even though the
    // board was unmounted: the next visit must re-read the authoritative
    // list instead of trusting the cache for the whole staleTime.
    await router.navigate({ href: '/squads' })
    expect(await screen.findByText('Created squad')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesBeforeCreate)
  })
})

describe('create squad — server error', () => {
  it('keeps the modal open and shows a friendly toast', async () => {
    onHttp('POST', '/api/rooms', () =>
      httpError(400, {
        message: 'Create limit reached',
        error: 'ROOM_CREATE_LIMIT_REACHED',
      })
    )
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await user.click(screen.getByLabelText('Game'))
    await user.click(await screen.findByText('League of Legends (1-5 players)'))
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() =>
      expect(toastStore.errorCalls[0]).toBe('You have reached the maximum number of active squads.')
    )
    expect(screen.getByLabelText('Squad Name')).toBeInTheDocument()
    expect(countHttpCalls('POST', '/api/rooms')).toBe(1)
  })
})
