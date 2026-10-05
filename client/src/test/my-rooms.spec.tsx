/**
 * Characterization tests for My squads (`/rooms/my`) after the CCC-42
 * capability migration.
 *
 * The page renders the lists `/api/rooms/my` returns: a Ready Room kept by the
 * server inside its 60-minute retention window stays visible to its members
 * and every card opens the lobby, and a room the server no longer returns is
 * gone on the next read. The client never filters Ready rooms on its own.
 *
 * HTTP runs through the deterministic adapter (./http-router); the route tree
 * and session come from the shared harness (./harness).
 */

import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderRoomsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { catalogGames, gameLol, guestPlayer, hostPlayer } from './fixtures'
import type { MyRoomsResponse, Room } from '@/types'

/**
 * A full Ready Room as `/api/rooms/my` returns it to a member: the readiness
 * timestamp is not part of the coordinated HTTP contract, only the lifecycle
 * outcome (still inside retention → still listed).
 */
const readyHostedRoom: Room = {
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

const readyJoinedRoom: Room = {
  ...readyHostedRoom,
  id: 'aaaaaaaa-0000-4000-8000-00000000000d',
  code: 'READY2',
  name: 'Joined ready squad',
  hostId: 'user-9',
}

function myRooms(hosted: Room[], joined: Room[]): MyRoomsResponse {
  return { hosted, joined }
}

beforeEach(() => {
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
  onHttp('GET', '/api/rooms/:code', () =>
    httpOk({ room: readyHostedRoom, players: [hostPlayer, guestPlayer] })
  )
  onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
})

describe('my squads — Ready Room retention', () => {
  it('keeps a Ready room the server still returns and opens its lobby', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([readyHostedRoom], [])))
    const { router, user } = renderRoomsFlow('/rooms/my')

    // A full room stays on screen and enabled for its member: the server's
    // retention contract decides visibility, not the room's capacity.
    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    expect(screen.getByText('Created (1)')).toBeInTheDocument()

    await user.click(screen.getByText('Ready squad'))

    await waitFor(() =>
      expect(router.history.location.pathname).toBe(`/rooms/${readyHostedRoom.code}`)
    )
  })

  it('keeps a Ready room the user joined under the Joined tab and opens its lobby', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([], [readyJoinedRoom])))
    const { router, user } = renderRoomsFlow('/rooms/my')
    await screen.findByText('My squads')

    await user.click(screen.getByText('Joined (1)'))

    expect(await screen.findByText('Joined ready squad')).toBeInTheDocument()
    await user.click(screen.getByText('Joined ready squad'))

    await waitFor(() => expect(router.history.location.pathname).toBe('/rooms/READY2'))
  })

  it('drops a Ready room once the server stops returning it', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([readyHostedRoom], [])))
    const firstVisit = renderRoomsFlow('/rooms/my')
    expect(await screen.findByText('Ready squad')).toBeInTheDocument()
    firstVisit.unmount()

    // The 60-minute retention deadline passed: the server's next answer no
    // longer carries the room, so the next read drops it before any cleanup.
    onHttp('GET', '/api/rooms/my', () => httpOk(myRooms([], [])))
    renderRoomsFlow('/rooms/my')

    expect(await screen.findByText('No squads here yet.')).toBeInTheDocument()
    expect(screen.queryByText('Ready squad')).not.toBeInTheDocument()
  })
})
