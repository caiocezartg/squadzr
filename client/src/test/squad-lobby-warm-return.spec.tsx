/**
 * The Lobby on a warm return (#197). The roster and the invite panel come only from the realtime
 * snapshot, and the snapshot used to die with the page: coming back to a Lobby the viewer had just left
 * showed pulsing placeholders until the socket answered, although the client already had the Lobby.
 *
 * The last snapshot of each Squad now survives in the query cache, so a warm return renders it at once and
 * the fresh snapshot replaces it entirely. A cold or hard load, a Squad the cache never saw, and a Squad
 * the viewer lost keep the placeholders.
 */

import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { squadSnapshotQueryKey } from '@/features/lobby/squad-snapshot-cache'
import { renderSquadsFlow } from './harness'
import { httpError, httpOk, onHttp } from './http-router'
import { expectLockedInvite } from './locked-invite'
import { settleNavigation } from './navigation'
import {
  boardSquads,
  guestPlayer,
  hostPlayer,
  lobbySnapshot,
  lobbySquad,
  lobbySquadResponse,
  readyLobbySnapshot,
} from './fixtures'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import type { RoomResponse, Squad } from '@/types'

const otherSquad: Squad = {
  ...lobbySquad,
  id: 'aaaaaaaa-0000-4000-8000-000000000009',
  code: 'OTHER1',
  name: 'Other squad',
}
const otherSquadResponse: RoomResponse = { room: otherSquad, players: [hostPlayer] }

const skeletons = () => screen.queryAllByTestId('member-tile-skeleton')

/** Whether the locked invite still pulses as a placeholder. */
const inviteIsPending = () =>
  screen.getByRole('region', { name: 'Discord invite' }).querySelector('.animate-pulse') !== null

beforeEach(() => {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/rooms/:code', (req) => {
    if (req.params.code === lobbySquad.code) return httpOk(lobbySquadResponse)
    if (req.params.code === otherSquad.code) return httpOk(otherSquadResponse)
    return httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
  })
  onHttp('GET', '/api/rooms/:code/discord-preview', () => httpOk({ preview: null }))
  onHttp('POST', '/api/rooms/:code/leave', () => httpOk({ ok: true }))
})

/** Opens the Lobby, receives its snapshot and goes to the board, the way a member walks away from it. */
async function visitLobbyAndLeave(
  snapshot = lobbySnapshot(),
  user?: Parameters<typeof renderSquadsFlow>[1]
) {
  const flow = renderSquadsFlow('/squads/LOBBY1', user)
  await screen.findByText('Squad ready check')
  openLatestWebSocket()
  sendFromServer({ type: 'room_snapshot', payload: snapshot })
  await screen.findByText('Ana')
  flow.navigation.router.push('/squads')
  await settleNavigation()
  await screen.findByText('Explore squads')
  return flow
}

async function returnToLobby(navigation: { router: { push: (href: string) => void } }) {
  navigation.router.push('/squads/LOBBY1')
  await settleNavigation()
}

describe('squad lobby — warm return', () => {
  it('shows a cold load with placeholders until the first snapshot', async () => {
    renderSquadsFlow('/squads/LOBBY1')

    expect(await screen.findByText('Squad ready check')).toBeInTheDocument()
    expect(screen.getByText('Loading members')).toBeInTheDocument()
    expect(skeletons()).toHaveLength(3)
    expect(inviteIsPending()).toBe(true)
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })

  it('renders the cached roster at once on a return, with no placeholder before the socket answers', async () => {
    const { navigation } = await visitLobbyAndLeave()

    await returnToLobby(navigation)

    // The page has not heard from the new socket yet: it renders what the last visit saw.
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Caio')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
    expect(screen.queryByText('Loading members')).not.toBeInTheDocument()
    expect(skeletons()).toHaveLength(0)
  })

  it('keeps the invite panel out of its placeholder on a return', async () => {
    const { navigation } = await visitLobbyAndLeave()

    await returnToLobby(navigation)
    await screen.findByText('Ana')

    expect(inviteIsPending()).toBe(false)
    expectLockedInvite()
  })

  it('replaces the cached snapshot entirely, roster, readiness and Presence, when the fresh one lands', async () => {
    const { navigation } = await visitLobbyAndLeave()
    await returnToLobby(navigation)
    await screen.findByText('Ana')
    openLatestWebSocket()

    // While the viewer was away Ana left and a new member filled the Squad, so it became ready.
    const newcomer = { ...guestPlayer, id: 'user-9', name: 'Bruno' }
    sendFromServer({
      type: 'room_snapshot',
      payload: readyLobbySnapshot({
        players: [hostPlayer, newcomer],
        presence: [
          { playerId: hostPlayer.id, online: true, offlineSince: null },
          { playerId: newcomer.id, online: true, offlineSince: null },
        ],
      }),
    })

    expect(await screen.findByText('Bruno')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Team closed' })).toBeDisabled()
  })

  it('updates the cache with the fresh snapshot, so the next return renders it', async () => {
    const { navigation, queryClient } = await visitLobbyAndLeave()
    await returnToLobby(navigation)
    await screen.findByText('Ana')
    openLatestWebSocket()
    const newcomer = { ...guestPlayer, id: 'user-9', name: 'Bruno' }
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({ players: [hostPlayer, newcomer] }),
    })
    await screen.findByText('Bruno')
    navigation.router.push('/squads')
    await settleNavigation()
    await screen.findByText('Explore squads')

    await returnToLobby(navigation)

    expect(await screen.findByText('Bruno')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(queryClient.getQueryData(squadSnapshotQueryKey('lobby1'))).toBeDefined()
  })

  it('shows placeholders again once the cache dropped the snapshot', async () => {
    const { navigation, queryClient } = await visitLobbyAndLeave()
    queryClient.removeQueries({ queryKey: squadSnapshotQueryKey('LOBBY1') })

    await returnToLobby(navigation)

    expect(await screen.findByText('Squad ready check')).toBeInTheDocument()
    expect(screen.getByText('Loading members')).toBeInTheDocument()
    expect(skeletons()).toHaveLength(3)
    expect(inviteIsPending()).toBe(true)
  })

  it('never renders the snapshot of another Squad when the page moves to one the cache has not seen', async () => {
    const { navigation } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')

    navigation.router.push(`/squads/${otherSquad.code}`)
    await settleNavigation()

    expect(await screen.findByText('Other squad')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByText('Loading members')).toBeInTheDocument()
    expect(skeletons()).toHaveLength(3)
  })

  it('renders the cached snapshot of the Squad the page moves to', async () => {
    const { navigation, queryClient } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')
    queryClient.setQueryData(
      squadSnapshotQueryKey(otherSquad.code),
      lobbySnapshot({
        room: { ...otherSquad, memberCount: 1, isMember: true },
        players: [{ ...hostPlayer, name: 'Duda' }],
        presence: [{ playerId: hostPlayer.id, online: true, offlineSince: null }],
      })
    )

    navigation.router.push(`/squads/${otherSquad.code}`)
    await settleNavigation()

    expect(await screen.findByText('Duda')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(skeletons()).toHaveLength(0)
  })
})

describe('squad lobby — warm return after losing access', () => {
  it('drops the cached snapshot when the Membership is revoked', async () => {
    const { navigation, queryClient } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')

    sendFromServer({
      type: 'error',
      payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this squad' },
    })
    await screen.findByText('You are not a member of this squad.')
    expect(queryClient.getQueryData(squadSnapshotQueryKey('LOBBY1'))).toBeUndefined()

    navigation.router.push('/squads')
    await settleNavigation()
    await returnToLobby(navigation)

    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })

  it('drops the cached snapshot when the Squad is deleted', async () => {
    const { queryClient, navigation } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')

    sendFromServer({
      type: 'room_deleted',
      payload: { roomId: lobbySquad.id, roomCode: 'LOBBY1' },
    })

    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads'))
    expect(queryClient.getQueryData(squadSnapshotQueryKey('LOBBY1'))).toBeUndefined()
  })

  it('drops the cached snapshot when the viewer leaves the Squad', async () => {
    const { queryClient, navigation, user } = renderSquadsFlow('/squads/LOBBY1', {
      user: { id: 'user-2', name: 'Ana', email: 'ana@squadzr.test', image: null },
    })
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Caio')
    expect(queryClient.getQueryData(squadSnapshotQueryKey('LOBBY1'))).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Leave squad' }))

    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads'))
    expect(queryClient.getQueryData(squadSnapshotQueryKey('LOBBY1'))).toBeUndefined()
  })
})
