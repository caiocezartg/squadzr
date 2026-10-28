/**
 * The Lobby on the App Router (CCC-80). These tests render the route's own server component,
 * `app/(app)/squads/[code]/page.tsx`, inside the providers the root layout gives it, with no TanStack router and
 * no app shell. The server reads the Squad for the viewer and hands the read to the browser, so each state
 * arrives through the dehydrated read and then the realtime snapshot.
 */

import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LobbyRoute from '@/app/(app)/squads/[code]/page'
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
import { expectLockedInvite } from './locked-invite'
import { squadQueryKey } from '@/features/lobby/squad-details'
import { httpError, httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import { latestWebSocket } from './ws-mock'

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

/** The providers of the root layout around a page. */
function withProviders(page: ReactNode, queryClient: QueryClient) {
  return (
    <EnglishIntlProvider session={fakeSession()}>
      <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>
    </EnglishIntlProvider>
  )
}

/**
 * Renders the page as Next does: the server component's output, awaited as the server awaits it, inside the
 * providers of the root layout.
 */
async function renderLobbyRoute(code: string, queryClient: QueryClient = createTestQueryClient()) {
  createHarnessNavigation(`/squads/${code}`)
  const page = await LobbyRoute({ params: Promise.resolve({ code }) })

  const view = render(withProviders(page, queryClient))
  return { ...view, queryClient }
}

describe('the Lobby on the App Router', () => {
  it('gives a signed-out visitor the sign-in prompt, whatever the Squad is', async () => {
    signOutFakeUser()
    onHttp('GET', '/api/rooms/:code', () => httpError(404, notFoundBody))

    await renderLobbyRoute(lobbySquad.code)

    expect(await screen.findByText('Please sign in to view this squad.')).toBeInTheDocument()
    expect(screen.queryByText('Squad not found')).not.toBeInTheDocument()
  })

  it('shows a signed-in non-member the public view, with no live channel to join', async () => {
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
    expect(screen.getByText('1/3 players')).toBeInTheDocument()
    expect(screen.getByText('Caio')).toBeInTheDocument()
    expect(screen.getAllByText('Open slot')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Join squad' })).toBeEnabled()
    expectLockedInvite()

    // The read tells the page the viewer is outside the Squad, so the page never joins the squad channel.
    openLatestWebSocket()
    expect(latestWebSocket().sentFrames()).toEqual([])
    expect(screen.queryByRole('link', { name: 'Open in Discord' })).not.toBeInTheDocument()
  })

  it('shows a member the roster from the snapshot, with placeholders until it arrives', async () => {
    signInAsFakeUser()
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))

    await renderLobbyRoute(lobbySquad.code)

    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    expect(screen.getAllByText('Open slot')).toHaveLength(3)
    // The HTTP response carries the roster too, but the Lobby shows only the snapshot's.
    expect(screen.queryByText('Caio')).not.toBeInTheDocument()

    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })

    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Open slot')).toHaveLength(1)
  })

  it('renders its game from the Squad before and after a snapshot replaces it', async () => {
    signInAsFakeUser()
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))

    await renderLobbyRoute(lobbySquad.code)

    // The HTTP read carries League of Legends; the snapshot below carries Counter-Strike 2.
    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    expect(screen.getByText(lobbySquad.game.name)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: `${lobbySquad.game.name} cover` })).toHaveAttribute(
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
    expect(screen.getByRole('img', { name: `${gameCs2Summary.name} cover` })).toHaveAttribute(
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
    expect(screen.queryByRole('link', { name: 'Open in Discord' })).not.toBeInTheDocument()

    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await screen.findByRole('heading', { name: "Let's go to Discord" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open in Discord' })).toHaveAttribute(
      'href',
      'https://discord.gg/lobby'
    )
    expect(screen.getByRole('button', { name: 'Team closed' })).toBeDisabled()
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

    const slot = (await screen.findByText(guestPlayer.name)).closest('li')
    if (!slot) throw new Error('The member tile is not rendered')
    const image = slot.querySelector('img')
    if (!image) throw new Error('The avatar image is not rendered')
    fireEvent.error(image)

    expect(within(slot as HTMLElement).getByText('AN')).toBeInTheDocument()
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

  it('does not animate the first snapshot of the next Squad on a warm-cache switch', async () => {
    signInAsFakeUser()
    const nextSquad = {
      ...lobbySquad,
      id: 'aaaaaaaa-0000-4000-8000-000000000008',
      code: 'NEXT01',
      name: 'Next squad',
    }
    const queryClient = createTestQueryClient()
    for (const room of [lobbySquad, nextSquad]) {
      queryClient.setQueryData(
        squadQueryKey(room.code),
        { room, players: [] },
        { updatedAt: Date.now() - 120_000 }
      )
    }
    onHttp('GET', '/api/rooms/:code', () => deferred<MockHttpResponse>().promise)

    // The next Squad has members of its own, so a tile is in its final state only because that first
    // snapshot is not an arrival.
    const nextPlayers = [
      { id: 'user-8', name: 'Dora', image: null, isHost: true },
      { id: 'user-9', name: 'Edu', image: null, isHost: false },
    ]

    const view = await renderLobbyRoute(lobbySquad.code, queryClient)
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(await screen.findByText('Ana')).toBeInTheDocument()

    const nextPage = await LobbyRoute({ params: Promise.resolve({ code: nextSquad.code }) })
    view.rerender(withProviders(nextPage, queryClient))
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({
        room: { ...nextSquad, memberCount: nextPlayers.length, isMember: true },
        players: nextPlayers,
        presence: nextPlayers.map((player) => ({
          playerId: player.id,
          online: true,
          offlineSince: null,
        })),
      }),
    })

    // The next Squad's first snapshot is the room as it was: its tiles render in their final state.
    expect(await screen.findByText('Next squad')).toBeInTheDocument()
    expect(screen.getByText('Edu').closest('li')?.style.opacity).toBe('1')
  })
})
