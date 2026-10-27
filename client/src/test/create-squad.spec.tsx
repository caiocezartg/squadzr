/**
 * Characterization tests for the create-squad flow on the Squad Board page
 * and the sidebar's My squads.
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

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSquadsFlow } from './harness'
import { settleNavigation } from './navigation'
import {
  type MockHttpResponse,
  countHttpCalls,
  getHttpLog,
  httpCreated,
  httpError,
  httpOk,
  onHttp,
} from './http-router'
import { boardGames, boardSquads, createdSquad, gameCs2, gameLol, hostPlayer } from './fixtures'
import { toastStore } from './stubs'
import type { CreateRoomResponse, MyRoomsResponse } from '@/types'

const createSquadResponse: CreateRoomResponse = { room: createdSquad }

/** A response the test releases once it decides the request should settle. */
function deferredResponse(): {
  response: Promise<MockHttpResponse>
  respond: (response: MockHttpResponse) => void
} {
  let respond!: (response: MockHttpResponse) => void
  const response = new Promise<MockHttpResponse>((resolve) => {
    respond = resolve
  })
  return { response, respond }
}

/** Whether a game search for the term has already left the client. */
function hasSearched(term: string): boolean {
  return getHttpLog().some(
    (request) => request.path === '/api/games' && request.query.get('search') === term
  )
}

/** The popup that carries the list and its loading/empty copy. */
function gameListPopup(): HTMLElement {
  return screen.getByRole('listbox', { name: 'Games found' }).parentElement as HTMLElement
}

/**
 * Keeps every text the game list popup shows until `stop`. A MutationObserver
 * catches copy that appears only between two assertions, which a query at a
 * single instant would miss.
 */
function watchGameListText(): { texts: string[]; stop: () => void } {
  const popup = gameListPopup()
  const texts = [popup.textContent ?? '']
  const observer = new MutationObserver(() => {
    texts.push(popup.textContent ?? '')
  })
  observer.observe(popup, { childList: true, subtree: true, characterData: true })
  return { texts, stop: () => observer.disconnect() }
}

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

const GAME_LABEL = 'Which game will you play?'

async function openCreateModal(
  user: Awaited<ReturnType<typeof renderSquadsFlow>['user']>
): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Create squad' }))
  await screen.findByText('Choose the game', {}, { timeout: 5000 })
}

/** Types into the game combobox and picks the named result, as a keyboard user would. */
async function pickGame(
  user: Awaited<ReturnType<typeof renderSquadsFlow>['user']>,
  search: string,
  optionName: string | RegExp
): Promise<void> {
  const input = screen.getByLabelText(GAME_LABEL)
  await user.click(input)
  await user.type(input, search)
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
  expect(await screen.findByRole('option', { name: optionName })).toBeInTheDocument()
  await user.keyboard('{ArrowDown}{Enter}')
}

/** Moves from the current step to the next one, as the footer's primary button does. */
async function continueStep(
  user: Awaited<ReturnType<typeof renderSquadsFlow>['user']>
): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

/** Walks the three steps with valid values, stopping on the Discord step before it is submitted. */
async function fillWizard(
  user: Awaited<ReturnType<typeof renderSquadsFlow>['user']>,
  squadName = 'Created squad'
): Promise<void> {
  await pickGame(user, 'league', 'League of Legends, MOBA · 1–5 players')
  await continueStep(user)
  await user.type(await screen.findByLabelText('Squad Name'), squadName)
  await continueStep(user)
  await user.type(await screen.findByLabelText('Discord Invite Link'), 'https://discord.gg/created')
}

describe('create squad — entry point', () => {
  it('shows the create button only for signed-in users', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
  })

  it('asks a guest to sign in instead of opening the create dialog', async () => {
    const { user } = renderSquadsFlow('/squads', { user: null, shell: true })
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create squad' }))

    expect(await screen.findByText('Sign in required')).toBeInTheDocument()
    expect(screen.queryByText('Choose the game')).not.toBeInTheDocument()
  })
})

describe('create squad — client validation', () => {
  it('keeps Continue disabled on the game step until a game is picked', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await pickGame(user, 'league', 'League of Legends, MOBA · 1–5 players')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('blocks the details step and shows the name error', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    await pickGame(user, 'league', 'League of Legends, MOBA · 1–5 players')
    await continueStep(user)

    await continueStep(user)

    expect(await screen.findByText('Squad name is required')).toBeInTheDocument()
    expect(screen.getByText('Squad details')).toBeInTheDocument()
  })

  it('blocks submission and shows the invite error on the last step', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    await pickGame(user, 'league', 'League of Legends, MOBA · 1–5 players')
    await continueStep(user)
    await user.type(await screen.findByLabelText('Squad Name'), 'Created squad')
    await continueStep(user)

    await user.click(await screen.findByRole('button', { name: 'Create Squad' }))

    expect(await screen.findByText('Please enter a valid URL')).toBeInTheDocument()
    expect(countHttpCalls('POST', '/api/rooms')).toBe(0)
  })
})

describe('create squad — game search', () => {
  it('lists the games that match what the player typed', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    const input = screen.getByLabelText(GAME_LABEL)
    await user.click(input)
    expect(input).toHaveAttribute('role', 'combobox')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    const listbox = screen.getByRole('listbox', { name: 'Games found' })
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    expect(
      await screen.findByRole('option', { name: 'League of Legends, MOBA · 1–5 players' })
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
        { name: 'Counter-Strike 2, Shooter · 1–5 players' },
        { timeout: 3000 }
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('option', { name: 'League of Legends, MOBA · 1–5 players' })
      ).not.toBeInTheDocument()
    )
    const counterStrike = screen.getByRole('option', {
      name: 'Counter-Strike 2, Shooter · 1–5 players',
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

  it('keeps the previous results listed while the next term loads', async () => {
    const counter = deferredResponse()
    onHttp('GET', '/api/games', (request) => {
      const search = request.query.get('search') ?? ''
      if (search === 'league') return httpOk({ games: [gameLol] })
      if (search === 'counter') return counter.response
      return httpOk(boardGames)
    })

    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    const input = screen.getByLabelText(GAME_LABEL)
    await user.click(input)
    await user.type(input, 'league')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    // Watch the whole transition, not a single instant: the loading copy must
    // never appear between the second term's input and its results replacing
    // the first term's.
    const popupWatch = watchGameListText()

    await user.clear(input)
    await user.type(input, 'counter')
    await waitFor(() => expect(hasSearched('counter')).toBe(true))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Searching games…'))

    // The first term's result stays listed instead of the list blanking to the loading copy.
    expect(
      screen.getByRole('option', { name: 'League of Legends, MOBA · 1–5 players' })
    ).toBeInTheDocument()
    expect(within(gameListPopup()).queryByText('Searching games…')).not.toBeInTheDocument()

    counter.respond(httpOk({ games: [gameCs2] }))

    expect(
      await screen.findByRole('option', { name: 'Counter-Strike 2, Shooter · 1–5 players' })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('option', { name: 'League of Legends, MOBA · 1–5 players' })
      ).not.toBeInTheDocument()
    )
    popupWatch.stop()

    expect(popupWatch.texts.filter((text) => text.includes('Searching games…'))).toEqual([])
  })

  it('shows the empty message only after the response has no matches', async () => {
    const noMatches = deferredResponse()
    onHttp('GET', '/api/games', (request) => {
      const search = request.query.get('search') ?? ''
      if (search === 'league') return httpOk({ games: [gameLol] })
      if (search === 'zzz') return noMatches.response
      return httpOk(boardGames)
    })

    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    const input = screen.getByLabelText(GAME_LABEL)
    await user.click(input)
    await user.type(input, 'league')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    await user.clear(input)
    await user.type(input, 'zzz')
    await waitFor(() => expect(hasSearched('zzz')).toBe(true))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Searching games…'))

    // The previous match is still listed, and the empty copy waits for the answer.
    expect(
      screen.getByRole('option', { name: 'League of Legends, MOBA · 1–5 players' })
    ).toBeInTheDocument()
    expect(within(gameListPopup()).queryByText(/No game found for/)).not.toBeInTheDocument()

    noMatches.respond(httpOk({ games: [] }))

    expect(await within(gameListPopup()).findByText('No game found for “zzz”')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0))
  })

  it('aborts the request for a term the player already moved past', async () => {
    const league = deferredResponse()
    let leagueSignal: AbortSignal | undefined
    onHttp('GET', '/api/games', (request) => {
      const search = request.query.get('search') ?? ''
      if (search === 'league') {
        leagueSignal = request.signal
        return league.response
      }
      if (search === 'counter') return httpOk({ games: [gameCs2] })
      return httpOk(boardGames)
    })

    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    const input = screen.getByLabelText(GAME_LABEL)
    await user.click(input)
    await user.type(input, 'league')
    await waitFor(() => expect(hasSearched('league')).toBe(true))
    expect(leagueSignal?.aborted).toBe(false)

    await user.clear(input)
    await user.type(input, 'counter')

    await waitFor(() => expect(leagueSignal?.aborted).toBe(true))
    expect(
      await screen.findByRole('option', { name: 'Counter-Strike 2, Shooter · 1–5 players' })
    ).toBeInTheDocument()
    // The abandoned request never surfaces as an error or an empty list.
    expect(screen.queryByText(/No game found for/)).not.toBeInTheDocument()

    // Settle the mock behind the aborted request; the cancellation already won.
    league.respond(httpOk({ games: [gameLol] }))
  })

  it('answers a warm term from the cache without a new loading state', async () => {
    let counterRequests = 0
    onHttp('GET', '/api/games', (request) => {
      const search = request.query.get('search') ?? ''
      if (search === 'counter') {
        counterRequests += 1
        return httpOk({ games: [gameCs2] })
      }
      return httpOk(boardGames)
    })

    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    const input = screen.getByLabelText(GAME_LABEL)
    await user.click(input)
    await user.type(input, 'counter')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    expect(counterRequests).toBe(1)

    // Let the empty term read the popular games from the cache again.
    await user.clear(input)
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    await user.type(input, 'counter')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    expect(
      screen.getByRole('option', { name: 'Counter-Strike 2, Shooter · 1–5 players' })
    ).toBeInTheDocument()
    expect(counterRequests).toBe(1)
    expect(screen.getByRole('status')).toHaveTextContent('1 game found')
  })

  it('submits the gameId of the chosen result', async () => {
    registerCreateRoutes()
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    const gameInput = screen.getByLabelText(GAME_LABEL)
    await user.click(gameInput)
    await user.type(gameInput, 'counter')
    await user.click(
      await screen.findByRole(
        'option',
        { name: 'Counter-Strike 2, Shooter · 1–5 players' },
        { timeout: 3000 }
      )
    )
    await continueStep(user)
    await user.type(await screen.findByLabelText('Squad Name'), 'Created squad')
    await continueStep(user)
    await user.type(
      await screen.findByLabelText('Discord Invite Link'),
      'https://discord.gg/created'
    )

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() => {
      const post = getHttpLog().find((request) => request.method === 'POST')
      expect(post?.body).toMatchObject({ gameId: gameCs2.id })
    })
  })
})

describe('create squad — game picker', () => {
  it('scrolls the highlighted option into view for the keyboard only, never for the pointer', async () => {
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    const options = await screen.findAllByRole('option')
    scroll.mockClear()

    await user.hover(options[1]!)

    expect(screen.getByLabelText(GAME_LABEL)).toHaveAttribute(
      'aria-activedescendant',
      options[1]!.id
    )
    expect(scroll).not.toHaveBeenCalled()

    await user.click(screen.getByLabelText(GAME_LABEL))
    await user.keyboard('{ArrowUp}')

    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('closes the game list before the dialog on Escape, keeping the draft', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    const search = screen.getByLabelText(GAME_LABEL)
    await user.type(search, 'lea')
    expect(await screen.findByRole('listbox', { name: 'Games found' })).toBeInTheDocument()

    // The first Escape belongs to the list: Base UI's dialog ignores
    // `defaultPrevented`, so the event must not reach it.
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(screen.getByText('Choose the game')).toBeInTheDocument()
    expect(search).toHaveValue('lea')

    // With the list closed, Escape closes the dialog as before.
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Choose the game')).not.toBeInTheDocument())
  })

  it('keeps the dialog when the document listener hears the first Escape', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    const search = screen.getByLabelText(GAME_LABEL)
    await user.type(search, 'lea')
    expect(await screen.findByRole('listbox', { name: 'Games found' })).toBeInTheDocument()

    // Base UI's dismiss listener sits on the document, where Next also mounts
    // React; the picker cannot stop this event from reaching it.
    mirrorEscapeOnDocument()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(screen.getByText('Choose the game')).toBeInTheDocument()
    expect(search).toHaveValue('lea')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Choose the game')).not.toBeInTheDocument())
  })

  it('closes the list first on Escape even when focus is outside the search', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    expect(await screen.findByRole('listbox', { name: 'Games found' })).toBeInTheDocument()
    expect(screen.getByLabelText(GAME_LABEL)).not.toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(screen.getByText('Choose the game')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Choose the game')).not.toBeInTheDocument())
  })

  it('reopens the closed list when the player presses ArrowDown', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    const input = screen.getByLabelText(GAME_LABEL)
    await user.click(input)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{ArrowDown}')
    expect(await screen.findByRole('listbox', { name: 'Games found' })).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('announces the number of games the search found', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    const status = screen.getByRole('status')
    await user.click(screen.getByLabelText(GAME_LABEL))
    await waitFor(() => expect(status).toHaveTextContent('2 games found'))

    const gameInput = screen.getByLabelText(GAME_LABEL)
    await user.type(gameInput, 'counter')
    await waitFor(() => expect(status).toHaveTextContent('1 game found'))

    await user.type(gameInput, 'zzz')
    await waitFor(() => expect(status).toHaveTextContent('No games found. Try another name.'))
  })

  it('marks the picked game and enables Continue', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await pickGame(user, 'league', 'League of Legends, MOBA · 1–5 players')

    const chosen = screen.getByRole('option', { name: 'League of Legends, MOBA · 1–5 players' })
    expect(chosen).toHaveAttribute('aria-selected', 'true')
    expect(chosen.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()

    // The marked game stays picked while the player searches on.
    await user.clear(screen.getByLabelText(GAME_LABEL))
    expect(
      await screen.findByRole('option', { name: 'Counter-Strike 2, Shooter · 1–5 players' })
    ).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('lists the popular games under a heading while the field is empty', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    expect(await screen.findAllByRole('option')).toHaveLength(2)
    expect(screen.getByText('Popular now')).toBeInTheDocument()

    await user.type(screen.getByLabelText(GAME_LABEL), 'count')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    expect(screen.queryByText('Popular now')).not.toBeInTheDocument()
  })

  it('highlights the typed term in the name and shows the genre and size', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    await user.type(screen.getByLabelText(GAME_LABEL), 'Count')
    const option = await screen.findByRole('option', {
      name: 'Counter-Strike 2, Shooter · 1–5 players',
    })

    await waitFor(() => expect(option.querySelector('mark')).toHaveTextContent('Count'))
    expect(option).toHaveTextContent('Shooter · 1–5 players')
  })

  it('shows the initials tile when a cover does not load', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    const option = await screen.findByRole('option', {
      name: 'League of Legends, MOBA · 1–5 players',
    })

    fireEvent.error(option.querySelector('img')!)

    expect(within(option).getByTestId('game-initials')).toHaveTextContent('LO')
  })

  it('does not offer to suggest a game when nothing matches', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    await user.type(screen.getByLabelText(GAME_LABEL), 'zzz')

    expect(await screen.findByText('No game found for “zzz”')).toBeInTheDocument()
    expect(screen.queryByText(/suggest/i)).not.toBeInTheDocument()
  })
})

describe('create squad — step flow', () => {
  it('goes forward and back, keeping what the player entered', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    await pickGame(user, 'league', 'League of Legends, MOBA · 1–5 players')
    await continueStep(user)

    const name = await screen.findByLabelText('Squad Name')
    expect(screen.getByRole('heading', { name: 'Squad details' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('02 · DETAILS')
    await user.type(name, 'Draft squad')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByLabelText(GAME_LABEL)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    await continueStep(user)
    expect(await screen.findByLabelText('Squad Name')).toHaveValue('Draft squad')
  })

  it('closes the dialog with Escape on step 2 after a keyboard Continue', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)
    await pickGame(user, 'league', 'League of Legends, MOBA · 1–5 players')

    // A new term, then Enter with no active option: the form continues from the open search.
    await user.type(screen.getByLabelText(GAME_LABEL), 'x')
    await user.keyboard('{Enter}')
    await screen.findByLabelText('Squad Name')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Squad details')).not.toBeInTheDocument())
  })

  it('closes from Cancel on the first step', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByText('Choose the game')).not.toBeInTheDocument())
  })
})

describe('create squad — layout', () => {
  it('fills the screen below 640px and pins the footer to the bottom', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('max-sm:h-dvh', 'max-sm:w-full', 'max-sm:max-w-none')
    const footer = screen.getByRole('button', { name: 'Continue' }).parentElement!
    expect(footer).toHaveClass('sticky', 'bottom-0')
  })
})

describe('create squad — reopening', () => {
  it('starts from an empty form after the dialog closes', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    await user.type(screen.getByLabelText(GAME_LABEL), 'lea')
    // The first Escape closes the game list, the second the dialog.
    await user.keyboard('{Escape}{Escape}')

    await waitFor(() => expect(screen.queryByText('Choose the game')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Create squad' }))
    expect(await screen.findByText('Choose the game')).toBeInTheDocument()
    expect(screen.getByLabelText(GAME_LABEL)).toHaveValue('')
  })
})

describe('create squad — success flow', () => {
  it('posts the form payload and opens the created lobby', async () => {
    registerCreateRoutes()
    const { navigation, user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    await pickGame(user, 'league', 'League of Legends, MOBA · 1–5 players')
    await continueStep(user)

    await user.type(await screen.findByLabelText('Squad Name'), 'Created squad')
    expect(
      screen.getByText('Leave empty to use 5 players (League of Legends default).')
    ).toBeInTheDocument()
    const tagInput = screen.getByPlaceholderText('Type a tag...')
    await user.type(tagInput, 'ranked,')
    await user.type(tagInput, 'flex')
    await user.keyboard('{Enter}')
    await continueStep(user)

    await user.type(
      await screen.findByLabelText('Discord Invite Link'),
      'https://discord.gg/created'
    )

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
    const { navigation, user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    await fillWizard(user)

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

describe('create squad — sidebar my squads', () => {
  it('lists the new squad in the sidebar once it is created', async () => {
    const mySquads: MyRoomsResponse = { hosted: [], joined: [] }
    registerCreateRoutes()
    // Registered after the lobby route so the exact segment wins over `:code`.
    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads))
    const { user } = renderSquadsFlow('/squads', { shell: true })
    const sidebar = within(await screen.findByRole('complementary', { name: 'Menu' }))
    await sidebar.findByText('My squads')
    expect(sidebar.queryByText('Created squad')).not.toBeInTheDocument()

    // The server lists the new squad as soon as it exists.
    mySquads.hosted = [createdSquad]
    await user.click(sidebar.getByRole('button', { name: 'Create squad' }))
    await screen.findByText('Choose the game', {}, { timeout: 5000 })
    await fillWizard(user)
    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(
      () => expect(sidebar.getByRole('link', { name: /Created squad/ })).toBeInTheDocument(),
      { timeout: 5000 }
    )
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
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    await fillWizard(user)

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() =>
      expect(toastStore.errorCalls[0]).toBe('You have reached the maximum number of active squads.')
    )
    expect(screen.getByLabelText('Discord Invite Link')).toBeInTheDocument()
    expect(countHttpCalls('POST', '/api/rooms')).toBe(1)
  })

  it('asks for another game when the chosen game was delisted', async () => {
    onHttp('POST', '/api/rooms', () =>
      httpError(400, {
        message: 'Game is not available',
        error: 'INVALID_GAME',
      })
    )
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await openCreateModal(user)

    await fillWizard(user)

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))

    await waitFor(() =>
      expect(toastStore.errorCalls[0]).toBe(
        'This game is no longer available. Please choose another game.'
      )
    )
    expect(screen.getByLabelText('Discord Invite Link')).toBeInTheDocument()
  })
})
