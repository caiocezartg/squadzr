/**
 * The Lobby for a viewer outside the Squad (CCC-112). A visitor gets the sign-in prompt. A signed-in
 * non-member gets the public view: the cover, the counter, the member preview and the open slots, and the
 * locked invite. It has no Presence and no live channel, and the way in is "Join squad", which turns the
 * page into the member Lobby without a reload.
 */

import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { guestPlayer, hostPlayer, lobbySquad, lobbySnapshot } from './fixtures'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import { squadQueryKey } from '@/features/lobby/squad-details'
import { settleNavigation } from './navigation'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import { toastStore } from './stubs'
import { latestWebSocket } from './ws-mock'
import type { RoomResponse } from '@/types'

const outsider = { id: 'user-7', name: 'Outsider', email: 'outsider@squadzr.test', image: null }

/** The Squad as the server answers a viewer outside it: the public projection, with its member preview. */
const { discordLink: _discordLink, ...publicFields } = lobbySquad
const publicSquad = { ...publicFields, memberCount: 1, isMember: false }

/** The same Squad once the outsider is a member: the member view, with the roster and the invite. */
const memberView: RoomResponse = {
  room: {
    ...lobbySquad,
    memberCount: 2,
    memberPreview: [
      { id: hostPlayer.id, name: hostPlayer.name, image: hostPlayer.image },
      { id: outsider.id, name: outsider.name, image: outsider.image },
    ],
    isMember: true,
  },
  players: [hostPlayer, { id: outsider.id, name: outsider.name, image: null, isHost: false }],
}

/** Serves the public projection until the join lands, and the member view after it. */
function registerSquadRoutes(): { joined: () => boolean } {
  let joined = false
  onHttp('GET', '/api/rooms/:code', () =>
    joined ? httpOk(memberView) : httpOk({ room: publicSquad })
  )
  onHttp('GET', '/api/rooms', () => httpOk({ rooms: [publicSquad] }))
  onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [], joined: [] }))
  onHttp('POST', '/api/rooms/:code/join', () => {
    joined = true
    return httpOk({
      message: 'Joined',
      roomMember: {
        id: 'aaaaaaaa-0000-4000-8000-0000000000ff',
        roomId: lobbySquad.id,
        userId: outsider.id,
        joinedAt: new Date().toISOString(),
      },
    })
  })
  return { joined: () => joined }
}

beforeEach(() => {
  registerSquadRoutes()
})

describe('the Lobby for a visitor', () => {
  it('shows the sign-in prompt and nothing of the Squad', async () => {
    renderSquadsFlow('/squads/LOBBY1', { user: null })

    expect(await screen.findByText('Please sign in to view this squad.')).toBeInTheDocument()

    openLatestWebSocket()
    expect(latestWebSocket().sentFrames()).toEqual([])
    expect(screen.queryByText(lobbySquad.name)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join squad' })).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('discord.gg')
  })
})

describe('the Lobby for a signed-in non-member', () => {
  it('shows the cover, the counter, the preview tiles and open slots, and the locked invite', async () => {
    renderSquadsFlow('/squads/LOBBY1', { user: outsider })

    expect(await screen.findByRole('heading', { name: lobbySquad.name })).toBeInTheDocument()
    expect(screen.getByText('1/3 players')).toBeInTheDocument()
    expect(screen.getByText('Caio')).toBeInTheDocument()
    expect(screen.getAllByText('Open slot')).toHaveLength(2)
    expect(screen.getByText('Discord invite')).toBeInTheDocument()
    expect(screen.getByText('Unlocked when the squad completes')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Explore squads' })).toHaveAttribute('href', '/squads')
    expect(screen.getByRole('button', { name: 'Join squad' })).toBeEnabled()
  })

  it('shows no Presence, no live channel and no member actions', async () => {
    renderSquadsFlow('/squads/LOBBY1', { user: outsider })
    await screen.findByRole('heading', { name: lobbySquad.name })

    const host = screen.getByText('Caio').closest('li')
    if (!host) throw new Error('The host has no tile')
    expect(within(host).queryByText('In the room now')).not.toBeInTheDocument()
    expect(within(host).queryByText(/^Out of the room/)).not.toBeInTheDocument()
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave squad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy squad link' })).not.toBeInTheDocument()

    // The read told the page the viewer is outside the Squad: the socket never joins its channel.
    openLatestWebSocket()
    expect(latestWebSocket().sentFrames()).toEqual([])
  })

  it('counts every member while the preview names only five of them', async () => {
    const crowded = {
      ...publicSquad,
      maxPlayers: 8,
      memberCount: 7,
      memberPreview: Array.from({ length: 5 }, (_, index) => ({
        id: `member-${index}`,
        name: `Member ${index}`,
        image: null,
      })),
    }
    onHttp('GET', '/api/rooms/:code', () => httpOk({ room: crowded }))
    renderSquadsFlow('/squads/LOBBY1', { user: outsider })

    expect(await screen.findByText('7/8 players')).toBeInTheDocument()
    expect(screen.getByText('Member 4')).toBeInTheDocument()
    expect(screen.getAllByText('Open slot')).toHaveLength(1)
  })

  it('joins from the page and becomes the member Lobby without a reload', async () => {
    const routes = registerSquadRoutes()
    const { user, navigation } = renderSquadsFlow('/squads/LOBBY1', { user: outsider })
    await screen.findByRole('heading', { name: lobbySquad.name })
    openLatestWebSocket()

    await user.click(screen.getByRole('button', { name: 'Join squad' }))

    // The page stays where it is, and the member Lobby takes the non-member view's place.
    expect(await screen.findByRole('button', { name: 'Leave squad' })).toBeInTheDocument()
    expect(routes.joined()).toBe(true)
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1)
    expect(navigation.history.location.pathname).toBe('/squads/LOBBY1')
    expect(screen.queryByRole('button', { name: 'Join squad' })).not.toBeInTheDocument()

    // The member now joins the squad channel, and the snapshot fills the roster.
    await waitFor(() =>
      expect(latestWebSocket().sentFrames()).toContainEqual({
        type: 'join_room',
        payload: { roomCode: 'LOBBY1' },
      })
    )
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({
        room: memberView.room,
        players: [hostPlayer, { ...guestPlayer, id: outsider.id, name: outsider.name }],
        presence: [
          { playerId: hostPlayer.id, online: true, offlineSince: null },
          { playerId: outsider.id, online: true, offlineSince: null },
        ],
      }),
    })
    expect(await screen.findByText('Outsider')).toBeInTheDocument()
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('stays on the public view and says why when the join fails', async () => {
    onHttp('POST', '/api/rooms/:code/join', () =>
      httpError(409, { error: 'ROOM_FULL', message: 'The squad is full' })
    )
    const { user } = renderSquadsFlow('/squads/LOBBY1', { user: outsider })
    await screen.findByRole('heading', { name: lobbySquad.name })

    await user.click(screen.getByRole('button', { name: 'Join squad' }))

    await waitFor(() => expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1))
    expect(await screen.findByRole('button', { name: 'Join squad' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Leave squad' })).not.toBeInTheDocument()
  })

  it('still joins when the lists that follow the join cannot be read', async () => {
    const routes = registerSquadRoutes()
    onHttp('GET', '/api/rooms', () => httpError(500, { error: 'INTERNAL', message: 'Unavailable' }))
    onHttp('GET', '/api/rooms/my', () =>
      httpError(500, { error: 'INTERNAL', message: 'Unavailable' })
    )
    const { user } = renderSquadsFlow('/squads/LOBBY1', { user: outsider, shell: true })
    await screen.findByRole('heading', { name: lobbySquad.name })

    await user.click(screen.getByRole('button', { name: 'Join squad' }))

    // The join happened, and only the join decides: no "could not join" toast, and the member Lobby opens.
    expect(await screen.findByRole('button', { name: 'Leave squad' })).toBeInTheDocument()
    expect(routes.joined()).toBe(true)
    expect(toastStore.errorCalls).toEqual([])
  })

  it('reads the Squad again when the read that follows the join fails', async () => {
    let detailReads = 0
    let joined = false
    onHttp('POST', '/api/rooms/:code/join', () => {
      joined = true
      return httpOk({
        message: 'Joined',
        roomMember: {
          id: 'aaaaaaaa-0000-4000-8000-0000000000ff',
          roomId: lobbySquad.id,
          userId: outsider.id,
          joinedAt: new Date().toISOString(),
        },
      })
    })
    onHttp('GET', '/api/rooms/:code', () => {
      if (!joined) return httpOk({ room: publicSquad })
      detailReads += 1
      // The first read after the join fails; the Lobby reads again and gets the member view.
      return detailReads === 1
        ? httpError(500, { error: 'INTERNAL', message: 'Unavailable' })
        : httpOk(memberView)
    })
    const { user } = renderSquadsFlow('/squads/LOBBY1', { user: outsider })
    await screen.findByRole('heading', { name: lobbySquad.name })

    await user.click(screen.getByRole('button', { name: 'Join squad' }))

    expect(await screen.findByRole('button', { name: 'Leave squad' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join squad' })).not.toBeInTheDocument()
    expect(toastStore.errorCalls).toEqual([])
  })

  it('leaves the Squad channel of the member Lobby it comes from, on a warm switch to a non-member Lobby', async () => {
    const other = {
      ...publicSquad,
      id: 'aaaaaaaa-0000-4000-8000-000000000008',
      code: 'OTHER1',
      name: 'Other squad',
    }
    onHttp('GET', '/api/rooms/:code', (req) =>
      req.params.code === 'OTHER1' ? httpOk({ room: other }) : httpOk(memberView)
    )
    // The other Lobby was read as a non-member before: the cache already knows the viewer is outside it.
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(squadQueryKey('OTHER1'), { room: other })
    const { navigation } = renderSquadsFlow('/squads/LOBBY1', { user: outsider, queryClient })
    await screen.findByRole('heading', { name: lobbySquad.name })
    openLatestWebSocket()
    const socket = latestWebSocket()
    await waitFor(() =>
      expect(socket.sentFrames()).toContainEqual({
        type: 'join_room',
        payload: { roomCode: 'LOBBY1' },
      })
    )

    navigation.router.push('/squads/OTHER1')
    await settleNavigation()

    expect(await screen.findByRole('button', { name: 'Join squad' })).toBeInTheDocument()
    // The socket releases the room it was in, and joins none: its members no longer see this viewer there.
    await waitFor(() =>
      expect(socket.sentFrames()).toEqual([
        { type: 'join_room', payload: { roomCode: 'LOBBY1' } },
        { type: 'leave_room', payload: { roomCode: 'LOBBY1' } },
      ])
    )
  })
})
