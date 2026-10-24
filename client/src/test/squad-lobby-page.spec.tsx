/**
 * The Lobby on the App Router (CCC-80). These tests render the route's own server component,
 * `app/squads/[code]/page.tsx`, inside the providers the root layout gives it, with no TanStack router and
 * no app shell. The server reads the Squad for the viewer and hands the read to the browser, so each state
 * arrives through the dehydrated read and then the realtime snapshot.
 */

import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LobbyRoute from '@/app/squads/[code]/page'
import {
  gameCs2,
  gameCs2Summary,
  guestPlayer,
  lobbySquadResponse,
  lobbySquad,
  lobbySnapshot,
  readyLobbySnapshot,
} from './fixtures'
import { createTestQueryClient } from './harness'
import { squadQueryKey } from '@/features/lobby/squad-details'
import { httpError, httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'
import { openLatestWebSocket, sendFromServer } from './ws-flows'

// The server gives each request its own query client, which React's cache scopes to one request. The
// suite renders as a server does, so the page's read and the browser's cache are separate clients.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isServer: true,
}))

// The viewer's cookies and address come from a request, which the suite does not have.
vi.mock('@/lib/server/viewer', () => ({
  getRequestViewer: async () => ({ cookie: null, forwardedFor: null }),
}))

/** A promise the test settles by hand, for a read the test holds back. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/** The Squad as a visitor or a non-member reads it: the public projection, with no Discord invite. */
const { discordLink: _discordLink, ...publicLobbySquad } = lobbySquad

const notFoundBody = { error: 'ROOM_NOT_FOUND', message: 'Room not found' }

/**
 * Renders the page as Next does: the server component's output, awaited as the server awaits it, inside the
 * providers of the root layout.
 */
async function renderLobbyRoute(code: string, queryClient: QueryClient = createTestQueryClient()) {
  createHarnessNavigation(`/squads/${code}`)
  const page = await LobbyRoute({ params: Promise.resolve({ code }) })

  return render(
    <EnglishIntlProvider session={fakeSession()}>
      <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>
    </EnglishIntlProvider>
  )
}

describe('the Lobby on the App Router', () => {
  it('gives a signed-out visitor the sign-in prompt, whatever the Squad is', async () => {
    signOutFakeUser()
    onHttp('GET', '/api/rooms/:code', () => httpError(404, notFoundBody))

    await renderLobbyRoute(lobbySquad.code)

    expect(await screen.findByText('Please sign in to view this squad.')).toBeInTheDocument()
    expect(screen.queryByText('Squad not found')).not.toBeInTheDocument()
  })

  it('shows a signed-in non-member the public projection, then the membership error', async () => {
    signInAsFakeUser({
      id: 'user-7',
      name: 'Outsider',
      email: 'outsider@squadzr.test',
      image: null,
    })
    onHttp('GET', '/api/rooms/:code', () => httpOk({ room: publicLobbySquad }))

    await renderLobbyRoute(lobbySquad.code)

    // The server's read is in the first render: the name and the size come before any snapshot.
    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    expect(screen.getByText('0/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for player...')).toHaveLength(3)

    openLatestWebSocket()
    sendFromServer({
      type: 'error',
      payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this squad' },
    })

    expect(await screen.findByText('You are not a member of this squad.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()
  })

  it('shows a member the roster from the snapshot, with placeholders until it arrives', async () => {
    signInAsFakeUser()
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))

    await renderLobbyRoute(lobbySquad.code)

    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for player...')).toHaveLength(3)
    // The HTTP response carries the roster too, but the Lobby shows only the snapshot's.
    expect(screen.queryByText('Caio')).not.toBeInTheDocument()

    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })

    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for player...')).toHaveLength(1)
  })

  it('renders its game from the Squad before and after a snapshot replaces it', async () => {
    signInAsFakeUser()
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))

    await renderLobbyRoute(lobbySquad.code)

    // The HTTP read carries League of Legends; the snapshot below carries Counter-Strike 2.
    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    expect(screen.getByText(lobbySquad.game.name)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: lobbySquad.game.name })).toHaveAttribute(
      'src',
      lobbySquad.game.coverUrl
    )
    expect(screen.queryByText(gameCs2Summary.name)).not.toBeInTheDocument()

    openLatestWebSocket()
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({
        room: { ...lobbySquad, gameId: gameCs2.id, game: gameCs2Summary },
      }),
    })

    expect(await screen.findByText('2/3 players')).toBeInTheDocument()
    expect(screen.getByText(gameCs2Summary.name)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: gameCs2Summary.name })).toHaveAttribute(
      'src',
      gameCs2Summary.coverUrl
    )
    expect(screen.queryByText(lobbySquad.game.name)).not.toBeInTheDocument()
  })

  it('locks the leave button and reveals the invite once the snapshot of a Ready Squad arrives', async () => {
    signInAsFakeUser()
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))

    await renderLobbyRoute(lobbySquad.code)
    await screen.findByText(lobbySquad.name)
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()

    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await screen.findByText('Your squad is ready!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Join Discord' })).toHaveAttribute(
      'href',
      'https://discord.gg/lobby'
    )
    expect(screen.getByRole('button', { name: 'Squad locked' })).toBeDisabled()
  })

  it('shows a signed-in viewer the not-found state for a missing Squad', async () => {
    signInAsFakeUser()
    onHttp('GET', '/api/rooms/:code', () => httpError(404, notFoundBody))

    await renderLobbyRoute('ZZZZZZ')

    expect(await screen.findByText('Squad not found')).toBeInTheDocument()
    expect(screen.getByText('ZZZZZZ')).toBeInTheDocument()
  })

  it("shows a player's initial in the roster once the avatar image fails to load", async () => {
    signInAsFakeUser()
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))

    await renderLobbyRoute(lobbySquad.code)
    await screen.findByText(lobbySquad.name)
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })

    const slot = (await screen.findByText(guestPlayer.name)).closest('.rounded-xl')
    if (!slot) throw new Error('The roster slot is not rendered')
    const image = slot.querySelector('img')
    if (!image) throw new Error('The avatar image is not rendered')
    fireEvent.error(image)

    expect(within(slot as HTMLElement).getByText('A')).toBeInTheDocument()
    expect(slot.querySelector('img')).toBeNull()
  })

  it('shows the lobby skeleton while a first visit waits for the Squad', async () => {
    signInAsFakeUser()
    const squadRead = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/:code', () => squadRead.promise)

    await renderLobbyRoute(lobbySquad.code)

    expect(await screen.findByTestId('lobby-skeleton')).toBeInTheDocument()
    expect(screen.queryByText(lobbySquad.name)).not.toBeInTheDocument()

    squadRead.resolve(httpOk(lobbySquadResponse))

    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    expect(screen.queryByTestId('lobby-skeleton')).not.toBeInTheDocument()
  })

  it('renders the Squad the cache holds at once on a client navigation, with no skeleton', async () => {
    signInAsFakeUser()
    const queryClient = createTestQueryClient()
    // The cache is older than the read, so the read is still running when the page renders.
    queryClient.setQueryData(squadQueryKey(lobbySquad.code), lobbySquadResponse, {
      updatedAt: Date.now() - 120_000,
    })
    onHttp('GET', '/api/rooms/:code', () => deferred<MockHttpResponse>().promise)

    await renderLobbyRoute(lobbySquad.code, queryClient)

    expect(screen.getByText(lobbySquad.name)).toBeInTheDocument()
    expect(screen.queryByTestId('lobby-skeleton')).not.toBeInTheDocument()
  })
})
