/**
 * Characterization tests for the create-squad flow on the Squad Board page
 * and on My Squads (`/squads/my`).
 *
 * Covers the gating of the create button by session state, client-side
 * validation of the form, the payload posted to the API on success (including
 * navigation to the created lobby), the board refresh shared by both entry
 * points, the game search combobox and the error presentation when the server
 * rejects the creation (including a game that left the catalog).
 *
 * HTTP runs through the deterministic adapter (./http-router); auth and
 * toasts are module mocks (./stubs). No test touches private hook state.
 */

import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderSquadsFlow } from './harness'
import { settleNavigation } from './navigation'
import { countHttpCalls, getHttpLog, httpCreated, httpError, httpOk, onHttp } from './http-router'
import { boardGames, boardSquads, createdSquad, gameCs2, gameLol, hostPlayer } from './fixtures'
import { toastStore } from './stubs'
import type { CreateRoomResponse, MyRoomsResponse } from '@/types'

const createSquadResponse: CreateRoomResponse = { room: createdSquad }

function registerBoardRoutes(): void {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/games', (request) => {
    const search = request.query.get('search')?.toLowerCase() ?? ''
    return httpOk({
      games: boardGames.games.filter((game) => game.name.toLowerCase().includes(search)),
    })
  })
}

function registerCreateRoutes(): void {
  onHttp('POST', '/api/rooms', () => httpCreated(createSquadResponse))
  onHttp('GET', '/api/rooms/:code', () =>
    httpOk({
      room: createdSquad,
      players: [hostPlayer],
    })
  )
}

beforeEach(() => {
  registerBoardRoutes()
})

let stopEscapeMirror: (() => void) | undefined

afterEach(() => {
  stopEscapeMirror?.()
  stopEscapeMirror = undefined
})

/**
 * Delivers each Escape to the `document` as well. Testing Library mounts the
 * tree inside a div below the document, so the test re-sends the key there to
 * cover a key that also reaches the document. The dialog cancels its own Escape
 * dismissal while the game list is open, so the outcome does not depend on how
 * far the key propagates.
 */
function mirrorEscapeOnDocument(): void {
  const mirror = (event: KeyboardEvent) => {
    // The re-sent key is dispatched on the document itself; ignore it so the
    // listener does not mirror its own event.
    if (event.key !== 'Escape' || event.target === document) return
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  }

  document.addEventListener('keydown', mirror, true)
  stopEscapeMirror = () => document.removeEventListener('keydown', mirror, true)
}

async function openCreateModal(
  user: Awaited<ReturnType<typeof renderSquadsFlow>['user']>
): Promise<void> {
  await user.click(await screen.findByText('Create new squad'))
  await screen.findByText('Create a Squad', {}, { timeout: 5000 })
}

/** Types into the game combobox and picks the named result, as a keyboard user would. */
async function pickGame(
  user: Awaited<ReturnType<typeof renderSquadsFlow>['user']>,
  search: string,
  optionName: string | RegExp
): Promise<void> {
  const input = screen.getByLabelText('Game')
  await user.click(input)
  await user.type(input, search)
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
  expect(await screen.findByRole('option', { name: optionName })).toBeInTheDocument()
  await user.keyboard('{ArrowDown}{Enter}')
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

describe('create squad — game search', () => {
  it('lists the games that match what the player typed', async () => {
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    const input = screen.getByLabelText('Game')
    await user.click(input)
    expect(input).toHaveAttribute('role', 'combobox')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    const listbox = screen.getByRole('listbox', { name: 'Select a game' })
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    expect(
      await screen.findByRole('option', { name: 'League of Legends (1-5 players)' })
    ).toBeInTheDocument()

    await user.type(input, 'count')

    // The typing is debounced: the request leaves only after the player pauses.
    await waitFor(() =>
      expect(
        getHttpLog().some(
          (request) => request.path === '/api/games' && request.query.get('search') === 'count'
        )
      ).toBe(true)
    )
    expect(
      await screen.findByRole(
        'option',
        { name: 'Counter-Strike 2 (1-5 players)' },
        { timeout: 3000 }
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('option', { name: 'League of Legends (1-5 players)' })
      ).not.toBeInTheDocument()
    )
    const counterStrike = screen.getByRole('option', {
      name: 'Counter-Strike 2 (1-5 players)',
    })
    expect(input).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(input).toHaveAttribute('aria-activedescendant', counterStrike.id)
    expect(
      getHttpLog().filter(
        (request) => request.path === '/api/games' && request.query.get('search') === 'count'
      )
    ).toHaveLength(1)
  })

  it('submits the gameId of the chosen result', async () => {
    registerCreateRoutes()
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    const gameInput = screen.getByLabelText('Game')
    await user.click(gameInput)
    await user.type(gameInput, 'counter')
    await user.click(
      await screen.findByRole(
        'option',
        { name: 'Counter-Strike 2 (1-5 players)' },
        { timeout: 3000 }
      )
    )
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() => {
      const post = getHttpLog().find((request) => request.method === 'POST')
      expect(post?.body).toMatchObject({ gameId: gameCs2.id })
    })
  })
})

describe('create squad — game picker', () => {
  it('closes the game list before the dialog on Escape, keeping the draft', async () => {
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    const name = screen.getByLabelText('Squad Name')
    await user.type(name, 'Draft squad')
    await user.click(screen.getByLabelText('Game'))
    expect(await screen.findByRole('listbox', { name: 'Select a game' })).toBeInTheDocument()

    // The first Escape belongs to the list: Base UI's dialog ignores
    // `defaultPrevented`, so the event must not reach it.
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(screen.getByText('Create a Squad')).toBeInTheDocument()
    expect(name).toHaveValue('Draft squad')

    // With the list closed, Escape closes the dialog as before.
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Create a Squad')).not.toBeInTheDocument())
  })

  it('keeps the dialog when the document listener hears the first Escape', async () => {
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    const name = screen.getByLabelText('Squad Name')
    await user.type(name, 'Draft squad')
    await user.click(screen.getByLabelText('Game'))
    expect(await screen.findByRole('listbox', { name: 'Select a game' })).toBeInTheDocument()

    // Base UI's dismiss listener sits on the document, where Next also mounts
    // React; the picker cannot stop this event from reaching it.
    mirrorEscapeOnDocument()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(screen.getByText('Create a Squad')).toBeInTheDocument()
    expect(name).toHaveValue('Draft squad')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Create a Squad')).not.toBeInTheDocument())
  })

  it('toggles the list from the chevron button', async () => {
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.click(screen.getByLabelText('Game'))
    const listbox = await screen.findByRole('listbox', { name: 'Select a game' })

    const hide = screen.getByRole('button', { name: 'Hide games' })
    expect(hide).toHaveAttribute('tabindex', '-1')
    expect(hide).toHaveAttribute('aria-controls', listbox.id)

    await user.click(hide)
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Show games' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    await user.click(screen.getByRole('button', { name: 'Show games' }))
    expect(await screen.findByRole('listbox', { name: 'Select a game' })).toBeInTheDocument()
  })

  it('announces the number of games the search found', async () => {
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    const status = screen.getByRole('status')
    await user.click(screen.getByLabelText('Game'))
    await waitFor(() => expect(status).toHaveTextContent('2 games found'))

    const gameInput = screen.getByLabelText('Game')
    await user.type(gameInput, 'counter')
    await waitFor(() => expect(status).toHaveTextContent('1 game found'))

    await user.type(gameInput, 'zzz')
    await waitFor(() => expect(status).toHaveTextContent('No games found. Try another name.'))
  })

  it('marks the chosen game as selected when the list reopens', async () => {
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)
    await pickGame(user, 'league', 'League of Legends (1-5 players)')

    await user.click(screen.getByLabelText('Game'))

    const chosen = await screen.findByRole('option', {
      name: 'League of Legends (1-5 players)',
    })
    expect(chosen).toHaveAttribute('aria-selected', 'true')
    expect(chosen.querySelector('svg')).not.toBeNull()
    // The chosen label stops the search, so the popular games return after the debounce.
    expect(
      await screen.findByRole('option', { name: 'Counter-Strike 2 (1-5 players)' })
    ).toHaveAttribute('aria-selected', 'false')
  })
})

describe('create squad — reopening', () => {
  it('starts from an empty form after the dialog closes', async () => {
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.type(screen.getByLabelText('Squad Name'), 'Draft squad')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Create a Squad')).not.toBeInTheDocument())

    await user.click(screen.getByText('Create new squad'))
    expect(await screen.findByText('Create a Squad')).toBeInTheDocument()
    expect(screen.getByLabelText('Squad Name')).toHaveValue('')
  })
})

describe('create squad — success flow', () => {
  it('posts the form payload and opens the created lobby', async () => {
    registerCreateRoutes()
    const { navigation, user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await pickGame(user, 'league', 'League of Legends (1-5 players)')
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
      expect(navigation.history.location.pathname).toBe(`/squads/${createdSquad.code}`)
    )
    expect(screen.getByText('Created squad')).toBeInTheDocument()
  })
})

describe('create squad — returning to the board', () => {
  it('shows the created squad after the lobby and re-reads the board', async () => {
    registerCreateRoutes()
    const serverSquads = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: serverSquads.rooms }))
    const { navigation, user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await pickGame(user, 'league', 'League of Legends (1-5 players)')
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')

    // The server lists the squad as soon as it exists.
    serverSquads.rooms = [...serverSquads.rooms, createdSquad]
    const fetchesBeforeCreate = countHttpCalls('GET', '/api/rooms')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))
    await waitFor(() =>
      expect(navigation.history.location.pathname).toBe(`/squads/${createdSquad.code}`)
    )

    // The create flow refreshes the board before it navigates to the lobby.
    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(fetchesBeforeCreate)
    )

    navigation.router.push('/squads')
    await settleNavigation()
    expect(await screen.findByText('Created squad')).toBeInTheDocument()
  })
})

describe('create squad — from my squads', () => {
  it('refreshes the board so the new squad appears when returning to it', async () => {
    const serverSquads = { rooms: [...boardSquads.rooms] }
    const mySquads: MyRoomsResponse = { hosted: [], joined: [] }
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: serverSquads.rooms }))
    registerCreateRoutes()
    // Registered after the lobby route so the exact segment wins over `:code`.
    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads))
    const { navigation, user } = renderSquadsFlow('/squads')

    // The board is loaded and fresh when the user leaves for My Squads.
    await screen.findByText('Ranked grind')
    navigation.router.push('/squads/my')
    await settleNavigation()
    await screen.findByText('My squads')

    // The server lists the new squad in both lists as soon as it exists.
    serverSquads.rooms = [...serverSquads.rooms, createdSquad]
    mySquads.hosted = [createdSquad]
    const fetchesBeforeCreate = countHttpCalls('GET', '/api/rooms')

    await user.click(screen.getByRole('button', { name: 'Create new squad' }))
    await screen.findByText('Create a Squad', {}, { timeout: 5000 })
    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await pickGame(user, 'league', 'League of Legends (1-5 players)')
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')
    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() =>
      expect(navigation.history.location.pathname).toBe(`/squads/${createdSquad.code}`)
    )

    // The create capability asked the board to refresh even though the
    // board was unmounted: the next visit must re-read the authoritative
    // list instead of trusting the cache for the whole staleTime.
    navigation.router.push('/squads')
    await settleNavigation()
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
    await pickGame(user, 'league', 'League of Legends (1-5 players)')
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() =>
      expect(toastStore.errorCalls[0]).toBe('You have reached the maximum number of active squads.')
    )
    expect(screen.getByLabelText('Squad Name')).toBeInTheDocument()
    expect(countHttpCalls('POST', '/api/rooms')).toBe(1)
  })

  it('asks for another game when the chosen game was delisted', async () => {
    onHttp('POST', '/api/rooms', () =>
      httpError(400, {
        message: 'Game is not available',
        error: 'INVALID_GAME',
      })
    )
    const { user } = renderSquadsFlow('/squads')
    await openCreateModal(user)

    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await pickGame(user, 'league', 'League of Legends (1-5 players)')
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() =>
      expect(toastStore.errorCalls[0]).toBe(
        'This game is no longer available. Please choose another game.'
      )
    )
    expect(screen.getByLabelText('Squad Name')).toBeInTheDocument()
  })
})
