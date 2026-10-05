/**
 * Characterization tests for the create-room flow on the rooms catalog page.
 *
 * Covers the gating of the create button by session state, client-side
 * validation of the form, the payload posted to the API on success (including
 * navigation to the created lobby) and the error presentation when the server
 * rejects the creation.
 *
 * HTTP runs through the deterministic adapter (./http-router); auth and
 * toasts are module mocks (./stubs). No test touches private hook state.
 */

import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderRoomsFlow } from './harness'
import { countHttpCalls, getHttpLog, httpCreated, httpError, httpOk, onHttp } from './http-router'
import {
  catalogGames,
  catalogRooms,
  createRoomResponse,
  createdRoom,
  gameLol,
  hostPlayer,
} from './fixtures'
import { toastStore } from './stubs'

function registerCatalogRoutes(): void {
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
}

function registerCreateRoutes(): void {
  onHttp('POST', '/api/rooms', () => httpCreated(createRoomResponse))
  onHttp('GET', '/api/rooms/:code', () =>
    httpOk({
      room: createdRoom,
      players: [hostPlayer],
    })
  )
  onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
}

beforeEach(() => {
  registerCatalogRoutes()
})

async function openCreateModal(
  user: Awaited<ReturnType<typeof renderRoomsFlow>['user']>
): Promise<void> {
  await user.click(await screen.findByText('Create new squad'))
  await screen.findByText('Create a Squad')
}

describe('create room — entry point', () => {
  it('shows the create button only for signed-in users', async () => {
    const { user } = renderRoomsFlow('/rooms')
    await openCreateModal(user)
  })

  it('hides the create button for guests', async () => {
    renderRoomsFlow('/rooms', { user: null })
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByText('Create new squad')).not.toBeInTheDocument()
  })
})

describe('create room — client validation', () => {
  it('blocks submission and shows field errors for an empty form', async () => {
    const { user } = renderRoomsFlow('/rooms')
    await openCreateModal(user)

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    expect(await screen.findByText('Squad name is required')).toBeInTheDocument()
    expect(screen.getByText('Please select a game')).toBeInTheDocument()
    expect(screen.getByText('Please enter a valid URL')).toBeInTheDocument()
    expect(countHttpCalls('POST', '/api/rooms')).toBe(0)
  })
})

describe('create room — success flow', () => {
  it('posts the form payload and opens the created lobby', async () => {
    registerCreateRoutes()
    const { router, user } = renderRoomsFlow('/rooms')
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

    await waitFor(() => expect(router.history.location.pathname).toBe(`/rooms/${createdRoom.code}`))
    expect(screen.getByText('Created squad')).toBeInTheDocument()
  })
})

describe('create room — returning to the catalog', () => {
  it('shows the created room after the lobby and re-reads the catalog', async () => {
    registerCreateRoutes()
    const serverRooms = { rooms: [...catalogRooms.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: serverRooms.rooms }))
    const { router, user } = renderRoomsFlow('/rooms')
    await openCreateModal(user)

    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await user.click(screen.getByLabelText('Game'))
    await user.click(await screen.findByText('League of Legends (1-5 players)'))
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')

    // The server lists the room as soon as it exists.
    serverRooms.rooms = [...serverRooms.rooms, createdRoom]
    const fetchesBeforeCreate = countHttpCalls('GET', '/api/rooms')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))
    await waitFor(() => expect(router.history.location.pathname).toBe(`/rooms/${createdRoom.code}`))

    // The create flow refreshes the catalog before it navigates to the lobby.
    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesBeforeCreate)
    )

    await router.navigate({ to: '/rooms', search: {} })
    expect(await screen.findByText('Created squad')).toBeInTheDocument()
  })
})

describe('create room — server error', () => {
  it('keeps the modal open and shows a friendly toast', async () => {
    onHttp('POST', '/api/rooms', () =>
      httpError(400, {
        message: 'Create limit reached',
        error: 'ROOM_CREATE_LIMIT_REACHED',
      })
    )
    const { user } = renderRoomsFlow('/rooms')
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
