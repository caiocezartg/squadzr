/**
 * The Lobby on a warm return (#197). The roster and the invite panel come only from the realtime
 * snapshot, and the snapshot used to die with the page: coming back to a Lobby the viewer had just left
 * showed pulsing placeholders until the socket answered, although the client already had the Lobby.
 *
 * The last snapshot of each Squad now survives in the query cache, so a warm return renders it at once and
 * the fresh snapshot replaces it entirely. A cold or hard load, a Squad the cache never saw, and a Squad
 * the viewer lost keep the placeholders.
 */

import { act, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { squadQueryKey } from '@/features/lobby/squad-details'
import { squadSnapshotQueryKey } from '@/features/lobby/squad-snapshot-cache'
import { createTestQueryClient, renderSquadsFlow } from './harness'
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
import { latestWebSocket } from './ws-mock'
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

/** The Squad as the server answers a viewer outside it: the public projection, with no invite. */
const { discordLink: _discordLink, discordCall: _discordCall, ...publicFields } = lobbySquad
const publicSquad = { ...publicFields, memberCount: 1, isMember: false }

const tileOf = (name: string): HTMLElement => {
  const tile = screen.getByText(name).closest('li')
  if (!tile) throw new Error(`${name} has no member tile`)
  return tile
}

/**
 * Records every element the page adds to the document that matches, including the ones a later commit
 * removes, so a placeholder or a roster that only lives for one commit still counts. `stop()` returns how
 * many it saw.
 */
function watchAdded(matches: (element: Element) => boolean) {
  let seen = 0
  const count = (records: MutationRecord[]) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        seen += [node, ...node.querySelectorAll('*')].filter(matches).length
      }
    }
  }
  const observer = new MutationObserver(count)
  observer.observe(document.body, { childList: true, subtree: true })
  return {
    stop: () => {
      count(observer.takeRecords())
      observer.disconnect()
      return seen
    },
  }
}

const isSkeleton = (element: Element) => element.matches('[data-testid="member-tile-skeleton"]')
const isTileOf = (name: string) => (element: Element) =>
  element.matches('li') && element.textContent?.includes(name) === true

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
  options?: Parameters<typeof renderSquadsFlow>[1]
) {
  const flow = renderSquadsFlow('/squads/LOBBY1', options)
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
    // The cached Presence is the last snapshot's until the fresh one lands.
    expect(tileOf('Caio')).toHaveAttribute('title', 'In the room now')
    expect(tileOf('Ana')).toHaveAttribute('title', 'Out of the room')

    // While the viewer was away Ana left, a new member filled the Squad so it became ready, and the host went out.
    const newcomer = { ...guestPlayer, id: 'user-9', name: 'Bruno' }
    sendFromServer({
      type: 'room_snapshot',
      payload: readyLobbySnapshot({
        players: [hostPlayer, newcomer],
        presence: [
          { playerId: hostPlayer.id, online: false, offlineSince: null },
          { playerId: newcomer.id, online: true, offlineSince: null },
        ],
      }),
    })

    expect(await screen.findByText('Bruno')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Team closed' })).toBeDisabled()
    expect(tileOf('Bruno')).toHaveAttribute('title', 'In the room now')
    expect(tileOf('Caio')).toHaveAttribute('title', 'Out of the room')
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

const ENTRANCE_CLASS = 'motion-safe:animate-invite-enter'

/**
 * What the page shows at the moment its socket sends the join for `squadCode`. The join is sent from an
 * effect, so this is the DOM of the page's first commit for that Squad, before any state an effect sets.
 */
function captureAtFirstJoin(squadCode: string) {
  let seen: { ana: boolean; duda: boolean; placeholders: number } | null = null
  const socket = latestWebSocket()
  const send = socket.send.bind(socket)
  vi.spyOn(socket, 'send').mockImplementation((data) => {
    if (seen === null && data.includes('join_room') && data.includes(squadCode)) {
      seen = {
        ana: screen.queryByText('Ana') !== null,
        duda: screen.queryByText('Duda') !== null,
        placeholders: skeletons().length,
      }
    }
    send(data)
  })
  return {
    seen: () => {
      if (seen === null) throw new Error(`the socket never sent the join for ${squadCode}`)
      return seen
    },
  }
}

describe.each([{ strictMode: false }, { strictMode: true }])(
  'squad lobby — first commit of a warm page (strict mode: $strictMode)',
  ({ strictMode }) => {
    it('never adds a placeholder when the viewer returns to a Squad the cache holds', async () => {
      const { navigation } = await visitLobbyAndLeave(lobbySnapshot(), { strictMode })
      const placeholders = watchAdded(isSkeleton)

      await returnToLobby(navigation)
      await screen.findByText('Ana')

      expect(placeholders.stop()).toBe(0)
      expect(inviteIsPending()).toBe(false)
    })

    it('paints the Squad it moves to from its cached snapshot, never the previous roster, on the first commit', async () => {
      const queryClient = createTestQueryClient()
      queryClient.setQueryData(squadQueryKey(otherSquad.code), otherSquadResponse)
      queryClient.setQueryData(
        squadSnapshotQueryKey(otherSquad.code),
        lobbySnapshot({
          room: { ...otherSquad, memberCount: 1, isMember: true },
          players: [{ ...hostPlayer, name: 'Duda' }],
          presence: [{ playerId: hostPlayer.id, online: true, offlineSince: null }],
        })
      )
      const { navigation } = renderSquadsFlow('/squads/LOBBY1', { queryClient, strictMode })
      await screen.findByText('Squad ready check')
      openLatestWebSocket()
      sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
      await screen.findByText('Ana')
      const frames = captureAtFirstJoin(otherSquad.code)

      navigation.router.push(`/squads/${otherSquad.code}`)
      await settleNavigation()

      // The join is sent from the effect, after the first commit of the new Squad and before the next.
      expect(frames.seen()).toEqual({ ana: false, duda: true, placeholders: 0 })
    })

    it('paints placeholders, never the previous roster, on the first commit of a Squad the cache has not seen', async () => {
      const queryClient = createTestQueryClient()
      queryClient.setQueryData(squadQueryKey(otherSquad.code), otherSquadResponse)
      const { navigation } = renderSquadsFlow('/squads/LOBBY1', { queryClient, strictMode })
      await screen.findByText('Squad ready check')
      openLatestWebSocket()
      sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
      await screen.findByText('Ana')
      const frames = captureAtFirstJoin(otherSquad.code)

      navigation.router.push(`/squads/${otherSquad.code}`)
      await settleNavigation()

      expect(frames.seen()).toEqual({ ana: false, duda: false, placeholders: 3 })
    })
  }
)

describe('squad lobby — warm return as a viewer outside the Squad', () => {
  beforeEach(() => {
    // The Squad's read now says the viewer is outside it: the public projection, with no roster.
    onHttp('GET', '/api/rooms/:code', () => httpOk({ room: publicSquad }))
  })

  it('renders the public view, never the cached roster, and drops the cached snapshot', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(squadQueryKey('LOBBY1'), { room: publicSquad })
    queryClient.setQueryData(squadSnapshotQueryKey('LOBBY1'), lobbySnapshot())
    const roster = watchAdded(isTileOf('Ana'))

    renderSquadsFlow('/squads/LOBBY1', { queryClient })

    expect(await screen.findByRole('button', { name: 'Join squad' })).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave squad' })).not.toBeInTheDocument()
    expect(screen.queryByText('In the room now')).not.toBeInTheDocument()
    expect(roster.stop()).toBe(0)
    await waitFor(() =>
      expect(queryClient.getQueryData(squadSnapshotQueryKey('LOBBY1'))).toBeUndefined()
    )
  })

  it('switches to the public view when the Squad read turns the viewer into a non-member after mount', async () => {
    onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))
    const { queryClient } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')
    expect(queryClient.getQueryData(squadSnapshotQueryKey('LOBBY1'))).toBeDefined()

    act(() => {
      queryClient.setQueryData(squadQueryKey('LOBBY1'), { room: publicSquad })
    })

    expect(await screen.findByRole('button', { name: 'Join squad' })).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave squad' })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(queryClient.getQueryData(squadSnapshotQueryKey('LOBBY1'))).toBeUndefined()
    )
  })
})

describe('squad lobby — warm return to a Squad that became Ready', () => {
  const invitePanel = async () =>
    (await screen.findByRole('heading', { name: "Let's go to Discord" })).closest('section')

  it('does not replay the Ready entrance for a Squad that filled while the viewer was away', async () => {
    const { navigation } = await visitLobbyAndLeave()
    await returnToLobby(navigation)
    await screen.findByText('Ana')
    openLatestWebSocket()

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    const panel = await invitePanel()
    expect(panel).not.toHaveClass(ENTRANCE_CLASS)
    expect(panel).not.toHaveClass('motion-reduce:animate-invite-fade')
  })

  it('still enters the panel for a viewer who watched the Squad form live after the return', async () => {
    const { navigation } = await visitLobbyAndLeave()
    await returnToLobby(navigation)
    await screen.findByText('Ana')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await invitePanel()).toHaveClass(ENTRANCE_CLASS)
  })
})
