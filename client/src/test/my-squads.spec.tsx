/**
 * Characterization tests for My Squads (`/squads/my`) after the Next migration.
 *
 * The page renders the lists `/api/rooms/my` returns: a Ready Squad kept by the
 * server inside its 60-minute retention window stays visible to its members
 * and every card opens the lobby, and a Squad the server no longer returns is
 * gone on the next read. The client never filters Ready Squads on its own.
 *
 * HTTP runs through the deterministic adapter (./http-router); the route tree
 * and session come from the shared harness (./harness).
 */

import { act, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import { settleNavigation } from './navigation'
import {
  boardGames,
  createdSquad,
  gameCs2,
  gameCs2Summary,
  gameLol,
  gameLolSummary,
  guestPlayer,
  hostPlayer,
  previewMembers,
} from './fixtures'
import type { MyRoomsResponse, Squad } from '@/types'

/**
 * A full Ready Squad as `/api/rooms/my` returns it to a member: the readiness
 * timestamp is not part of the coordinated HTTP contract, only the lifecycle
 * outcome (still inside retention → still listed).
 */
const readyHostedSquad: Squad = {
  id: 'aaaaaaaa-0000-4000-8000-00000000000c',
  code: 'READY1',
  name: 'Ready squad',
  hostId: 'user-1',
  gameId: gameLol.id,
  game: gameLolSummary,
  maxPlayers: 5,
  discordLink: 'https://discord.gg/ready',
  tags: ['ranked'],
  language: 'en',
  memberCount: 5,
  memberPreview: previewMembers(5),
  isMember: true,
  createdAt: new Date(Date.now() - 65 * 60_000).toISOString(),
  updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
}

const readyJoinedSquad: Squad = {
  ...readyHostedSquad,
  id: 'aaaaaaaa-0000-4000-8000-00000000000d',
  code: 'READY2',
  name: 'Joined ready squad',
  hostId: 'user-9',
  gameId: gameCs2.id,
  game: gameCs2Summary,
}

function mySquads(hosted: Squad[], joined: Squad[]): MyRoomsResponse {
  return { hosted, joined }
}

beforeEach(() => {
  onHttp('GET', '/api/games', (request) => {
    const search = request.query.get('search')?.toLowerCase() ?? ''
    return httpOk({
      games: boardGames.games.filter((game) => game.name.toLowerCase().includes(search)),
    })
  })
  onHttp('GET', '/api/rooms/:code', () =>
    httpOk({ room: readyHostedSquad, players: [hostPlayer, guestPlayer] })
  )
})

describe('my squads — filters through the URL', () => {
  it('filters both lists by the search in the URL and keeps the filter on the route', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads([readyHostedSquad], [readyJoinedSquad])))
    const { navigation, user } = renderSquadsFlow('/squads/my')
    expect(await screen.findByText('Ready squad')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search by game or squad name...'), 'Joined')

    await waitFor(() =>
      expect(
        Object.fromEntries(new URLSearchParams(navigation.history.location.search))
      ).toMatchObject({ search: 'Joined' })
    )
    expect(screen.queryByText('Ready squad')).not.toBeInTheDocument()

    await user.click(screen.getByText('Joined (1)'))
    expect(await screen.findByText('Joined ready squad')).toBeInTheDocument()
  })

  it('filters both lists by the game name their own summaries carry', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads([readyHostedSquad], [readyJoinedSquad])))
    const { user } = renderSquadsFlow('/squads/my')
    expect(await screen.findByText('Ready squad')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search by game or squad name...'), 'Counter')

    await waitFor(() => expect(screen.queryByText('Ready squad')).not.toBeInTheDocument())
    expect(screen.getByText('Joined ready squad')).toBeInTheDocument()
  })
})

describe('my squads — refresh behavior', () => {
  it('re-reads on mount and surfaces a Squad created while the page was away', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads([readyHostedSquad], [])))
    const queryClient = createTestQueryClient()
    // What the server dehydrated for the cached visit: the new Squad is not in it yet.
    queryClient.setQueryData(['my-squads'], mySquads([], []))

    renderSquadsFlow('/squads/my', { queryClient })

    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(1)
  })

  it('re-reads when the window regains focus', async () => {
    const response = mySquads([], [])
    onHttp('GET', '/api/rooms/my', () => httpOk(response))
    const { queryClient } = renderSquadsFlow('/squads/my')
    expect(await screen.findAllByText('No squads here yet.')).toHaveLength(2)

    // The cached answer is older than the stale time, as it is after a minute away.
    response.hosted = [readyHostedSquad]
    act(() => {
      queryClient.setQueryData(['my-squads'], mySquads([], []), {
        updatedAt: Date.now() - 120_000,
      })
    })
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(2)
  })

  it('re-reads after creating a Squad', async () => {
    const response = mySquads([], [])
    onHttp('GET', '/api/rooms/my', () => httpOk(response))
    onHttp('POST', '/api/rooms', () => httpOk({ room: createdSquad }))
    const { navigation, user } = renderSquadsFlow('/squads/my')
    await screen.findAllByText('No squads here yet.')

    await user.click(screen.getByRole('button', { name: 'Create new squad' }))
    await screen.findByText('Create a Squad')
    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    const gameInput = screen.getByLabelText('Game')
    await user.click(gameInput)
    await user.type(gameInput, 'league')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    expect(
      await screen.findByRole('option', { name: 'League of Legends (1-5 players)' })
    ).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')

    // The server lists the new Squad in My Squads as soon as it exists.
    response.hosted = [createdSquad]
    const readsBeforeCreate = countHttpCalls('GET', '/api/rooms/my')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))
    await waitFor(() =>
      expect(navigation.history.location.pathname).toBe(`/squads/${createdSquad.code}`)
    )
    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms/my')).toBeGreaterThan(readsBeforeCreate)
    )

    navigation.router.push('/squads/my')
    await settleNavigation()
    expect(await screen.findByText('Created squad')).toBeInTheDocument()
  })
})

describe('my squads — expired session', () => {
  it('sends the viewer to the landing, with no My Squads content, when the browser read answers 401', async () => {
    onHttp('GET', '/api/rooms/my', () => httpError(401, { error: 'UNAUTHORIZED', message: 'No' }))
    const { navigation, queryClient } = renderSquadsFlow('/squads/my')

    await waitFor(() => expect(navigation.calls).toContainEqual({ method: 'replace', href: '/' }))

    expect(screen.queryByRole('heading', { name: 'My squads' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('my-squads-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByText('No squads here yet.')).not.toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(1)
    // The 401 is not kept once the page is gone, so signing in again reads the lists instead of
    // redirecting on it.
    await waitFor(() => expect(queryClient.getQueryData(['my-squads'])).toBeUndefined())
  })

  it('reads the lists again when the viewer signs back in and returns', async () => {
    onHttp('GET', '/api/rooms/my', () => httpError(401, { error: 'UNAUTHORIZED', message: 'No' }))
    const firstVisit = renderSquadsFlow('/squads/my')
    await waitFor(() =>
      expect(firstVisit.navigation.calls).toContainEqual({ method: 'replace', href: '/' })
    )
    firstVisit.unmount()

    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads([readyHostedSquad], [])))
    const secondVisit = renderSquadsFlow('/squads/my', { queryClient: firstVisit.queryClient })

    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    expect(secondVisit.navigation.calls).toEqual([])
  })
})

describe('my squads — Ready Squad retention', () => {
  it('keeps a Ready Squad the server still returns and opens its lobby', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads([readyHostedSquad], [])))
    const { navigation, user } = renderSquadsFlow('/squads/my')

    // A full Squad stays on screen and enabled for its member: the server's
    // retention contract decides visibility, not the Squad's capacity.
    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    expect(screen.getByText('Created (1)')).toBeInTheDocument()

    await user.click(screen.getByText('Ready squad'))

    await waitFor(() =>
      expect(navigation.history.location.pathname).toBe(`/squads/${readyHostedSquad.code}`)
    )
  })

  it('keeps a Ready Squad the user joined under the Joined tab and opens its lobby', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads([], [readyJoinedSquad])))
    const { navigation, user } = renderSquadsFlow('/squads/my')
    await screen.findByText('Joined (1)')

    await user.click(screen.getByText('Joined (1)'))

    expect(await screen.findByText('Joined ready squad')).toBeInTheDocument()
    await user.click(screen.getByText('Joined ready squad'))

    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads/READY2'))
  })

  it('drops a Ready Squad once the server stops returning it', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads([readyHostedSquad], [])))
    const firstVisit = renderSquadsFlow('/squads/my')
    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    firstVisit.unmount()

    // The 60-minute retention deadline passed: the server's next answer no
    // longer carries the Squad, so the next read drops it before any cleanup.
    onHttp('GET', '/api/rooms/my', () => httpOk(mySquads([], [])))
    renderSquadsFlow('/squads/my')

    expect(await screen.findAllByText('No squads here yet.')).toHaveLength(2)
    expect(screen.queryByText('Ready squad')).not.toBeInTheDocument()
  })
})
