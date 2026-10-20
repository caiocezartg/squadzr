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
import { countHttpCalls, httpOk, onHttp } from './http-router'
import { boardGames, createdSquad, gameLol, guestPlayer, hostPlayer } from './fixtures'
import type { MyRoomsResponse, Squad } from '@/types'

/**
 * A full Ready Room as `/api/rooms/my` returns it to a member: the readiness
 * timestamp is not part of the coordinated HTTP contract, only the lifecycle
 * outcome (still inside retention → still listed).
 */
const readyHostedRoom: Squad = {
  id: 'aaaaaaaa-0000-4000-8000-00000000000c',
  code: 'READY1',
  name: 'Ready squad',
  hostId: 'user-1',
  gameId: gameLol.id,
  maxPlayers: 5,
  discordLink: 'https://discord.gg/ready',
  tags: ['ranked'],
  language: 'en',
  memberCount: 5,
  isMember: true,
  createdAt: new Date(Date.now() - 65 * 60_000).toISOString(),
  updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
}

const readyJoinedRoom: Squad = {
  ...readyHostedRoom,
  id: 'aaaaaaaa-0000-4000-8000-00000000000d',
  code: 'READY2',
  name: 'Joined ready squad',
  hostId: 'user-9',
}

function myRooms(hosted: Squad[], joined: Squad[]): MyRoomsResponse {
  return { hosted, joined }
}

beforeEach(() => {
  onHttp('GET', '/api/games', () => httpOk(boardGames))
  onHttp('GET', '/api/rooms/:code', () =>
    httpOk({ room: readyHostedRoom, players: [hostPlayer, guestPlayer] })
  )
  onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
})

describe('my squads — filters through the URL', () => {
  it('filters both lists by the search in the URL and keeps the filter on the route', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([readyHostedRoom], [readyJoinedRoom])))
    const { router, user } = renderSquadsFlow('/squads/my')
    expect(await screen.findByText('Ready squad')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search by game or squad name...'), 'Joined')

    await waitFor(() => expect(router.state.location.search).toMatchObject({ search: 'Joined' }))
    expect(screen.queryByText('Ready squad')).not.toBeInTheDocument()

    await user.click(screen.getByText('Joined (1)'))
    expect(await screen.findByText('Joined ready squad')).toBeInTheDocument()
  })
})

describe('my squads — refresh behavior', () => {
  it('re-reads on mount and surfaces a Squad created while the page was away', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([readyHostedRoom], [])))
    const queryClient = createTestQueryClient()
    // What the server dehydrated for the cached visit: the new Squad is not in it yet.
    queryClient.setQueryData(['my-squads'], myRooms([], []))
    queryClient.setQueryData(['games'], boardGames)

    renderSquadsFlow('/squads/my', { queryClient })

    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(1)
  })

  it('re-reads when the window regains focus', async () => {
    const response = myRooms([], [])
    onHttp('GET', '/api/rooms/my', () => httpOk(response))
    const { queryClient } = renderSquadsFlow('/squads/my')
    expect(await screen.findAllByText('No squads here yet.')).toHaveLength(2)

    // The cached answer is older than the stale time, as it is after a minute away.
    response.hosted = [readyHostedRoom]
    act(() => {
      queryClient.setQueryData(['my-squads'], myRooms([], []), {
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
    const response = myRooms([], [])
    onHttp('GET', '/api/rooms/my', () => httpOk(response))
    onHttp('POST', '/api/rooms', () => httpOk({ room: createdSquad }))
    const { router, user } = renderSquadsFlow('/squads/my')
    await screen.findAllByText('No squads here yet.')

    await user.click(screen.getByRole('button', { name: 'Create new squad' }))
    await screen.findByText('Create a Squad')
    await user.type(screen.getByLabelText('Squad Name'), 'Created squad')
    await user.click(screen.getByLabelText('Game'))
    await user.click(await screen.findByText('League of Legends (1-5 players)'))
    await user.type(screen.getByLabelText('Discord Invite Link'), 'https://discord.gg/created')

    // The server lists the new Squad in My Squads as soon as it exists.
    response.hosted = [createdSquad]
    const readsBeforeCreate = countHttpCalls('GET', '/api/rooms/my')

    await user.click(screen.getByRole('button', { name: 'Create Squad' }))
    await waitFor(() =>
      expect(router.history.location.pathname).toBe(`/squads/${createdSquad.code}`)
    )
    await waitFor(() =>
      expect(countHttpCalls('GET', '/api/rooms/my')).toBeGreaterThan(readsBeforeCreate)
    )

    await router.navigate({ href: '/squads/my' })
    expect(await screen.findByText('Created squad')).toBeInTheDocument()
  })
})

describe('my squads — Ready Squad retention', () => {
  it('keeps a Ready Squad the server still returns and opens its lobby', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([readyHostedRoom], [])))
    const { router, user } = renderSquadsFlow('/squads/my')

    // A full Squad stays on screen and enabled for its member: the server's
    // retention contract decides visibility, not the Squad's capacity.
    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    expect(screen.getByText('Created (1)')).toBeInTheDocument()

    await user.click(screen.getByText('Ready squad'))

    await waitFor(() =>
      expect(router.history.location.pathname).toBe(`/squads/${readyHostedRoom.code}`)
    )
  })

  it('keeps a Ready Squad the user joined under the Joined tab and opens its lobby', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([], [readyJoinedRoom])))
    const { router, user } = renderSquadsFlow('/squads/my')
    await screen.findByText('Joined (1)')

    await user.click(screen.getByText('Joined (1)'))

    expect(await screen.findByText('Joined ready squad')).toBeInTheDocument()
    await user.click(screen.getByText('Joined ready squad'))

    await waitFor(() => expect(router.history.location.pathname).toBe('/squads/READY2'))
  })

  it('drops a Ready Squad once the server stops returning it', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([readyHostedRoom], [])))
    const firstVisit = renderSquadsFlow('/squads/my')
    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    firstVisit.unmount()

    // The 60-minute retention deadline passed: the server's next answer no
    // longer carries the Squad, so the next read drops it before any cleanup.
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([], [])))
    renderSquadsFlow('/squads/my')

    expect(await screen.findAllByText('No squads here yet.')).toHaveLength(2)
    expect(screen.queryByText('Ready squad')).not.toBeInTheDocument()
  })
})
