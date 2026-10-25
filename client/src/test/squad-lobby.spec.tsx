/**
 * Characterization tests for the squad lobby page (`/squads/$code`) after the
 * typed realtime client (CCC-38).
 *
 * The roster, readiness, Presence and the authorized Discord link come only
 * from the WebSocket squad snapshot and the events that follow it. HTTP squad
 * data supplies static metadata and never overwrites live state, so the old
 * HTTP/WS race (`playersInitialized`) is gone.
 *
 * Covers the snapshot handshake, duplicate snapshots, Presence, the Discord
 * invite disclosure gated by snapshot readiness, the leave flow (member and
 * host), deletion/redirect events, error presentation (inline AlertBox,
 * squad-not-found) and the signed-out gate.
 *
 * HTTP runs through the deterministic adapter (./http-router) and WebSocket
 * through the mock socket (./ws-mock). No test touches private hook state.
 */

import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderSquadsFlow } from './harness'
import { httpError, httpOk, onHttp } from './http-router'
import { settleNavigation } from './navigation'
import {
  boardSquads,
  guestPlayer,
  hostPlayer,
  lobbySquad,
  lobbySquadResponse,
  lobbySnapshot,
  readyLobbySnapshot,
} from './fixtures'
import { openLatestWebSocket, sendFromServer, serverSentFrames } from './ws-flows'
import { latestWebSocket } from './ws-mock'
import type { RoomResponse, Squad } from '@/types'

const invalidDiscordSquad: Squad = {
  ...lobbySquad,
  id: 'aaaaaaaa-0000-4000-8000-000000000005',
  code: 'BADLNK',
  discordLink: 'https://not-discord.example/invite',
}

const invalidDiscordSquadResponse: RoomResponse = {
  room: invalidDiscordSquad,
  players: [hostPlayer],
}

function registerLobbyRoutes(): void {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/rooms/:code', (req) => {
    if (req.params.code === lobbySquad.code) return httpOk(lobbySquadResponse)
    if (req.params.code === invalidDiscordSquad.code) {
      return httpOk(invalidDiscordSquadResponse)
    }
    return httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
  })
  onHttp('POST', '/api/rooms/:code/join', () => httpOk({ ok: true }))
  onHttp('POST', '/api/rooms/:code/leave', () => httpOk({ ok: true }))
}

beforeEach(() => {
  registerLobbyRoutes()
})

describe('squad lobby — snapshot handshake', () => {
  it('joins the squad over WebSocket and renders the roster from the snapshot', async () => {
    renderSquadsFlow('/squads/LOBBY1')

    expect(await screen.findByText('Squad ready check')).toBeInTheDocument()
    // HTTP alone does not seed the live roster: it is empty until the snapshot.
    expect(screen.getByText('0/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for player...')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Leave squad' })).toBeInTheDocument()

    openLatestWebSocket()

    await waitFor(() =>
      expect(serverSentFrames()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'join_room',
            payload: { roomCode: 'LOBBY1' },
          }),
        ])
      )
    )

    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })

    expect(await screen.findByText('Caio')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
  })

  it('replaces the roster from every snapshot and never duplicates members', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    // A repeated player in the snapshot payload is collapsed.
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({ players: [hostPlayer, guestPlayer, guestPlayer] }),
    })
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getAllByText('Ana')).toHaveLength(1)
    expect(screen.getByText('2/3 players')).toBeInTheDocument()

    // A duplicate snapshot is harmless.
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(screen.getAllByText('Ana')).toHaveLength(1)
    expect(screen.getByText('2/3 players')).toBeInTheDocument()

    // A fresh snapshot replaces stale state: a member who left is gone.
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({
        players: [hostPlayer],
        presence: [{ playerId: hostPlayer.id, online: true, offlineSince: null }],
      }),
    })
    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument())
    expect(screen.getByText('1/3 players')).toBeInTheDocument()
  })

  it('renders Presence from the snapshot and applies presence_updated without adding members', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(await screen.findByText('Ana')).toBeInTheDocument()

    // Presence never relies on color alone: each member has an accessible
    // Online/Offline tooltip and the overall connection state has its own.
    expect(screen.getAllByRole('tooltip')).toHaveLength(3)
    expect(screen.getAllByText('Online')).toHaveLength(1)
    expect(screen.getAllByText('Offline')).toHaveLength(1)
    expect(screen.getAllByText('Connected')).toHaveLength(1)

    // The indicators are keyboard stops whose tooltips are the accessible
    // descriptions, exercised end to end through the `/squads/$code` flow.
    const presenceOnline = screen.getByText('Online').closest('[tabindex="0"]')
    const presenceOffline = screen.getByText('Offline').closest('[tabindex="0"]')
    const connection = screen.getByText('Connected').closest('[tabindex="0"]')
    expect(presenceOnline).toHaveAccessibleDescription('Online')
    expect(presenceOffline).toHaveAccessibleDescription('Offline')
    expect(connection).toHaveAccessibleDescription('Connected')

    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: true, offlineSince: null },
    })
    await waitFor(() => expect(screen.getAllByText('Online')).toHaveLength(2))

    // The server owns the aggregation (multiple sessions, grace window): the
    // client applies the boolean it receives in both directions.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: false, offlineSince: null },
    })
    await waitFor(() => expect(screen.getAllByText('Offline')).toHaveLength(1))
    expect(screen.getAllByText('Online')).toHaveLength(1)

    // A duplicate transition and a transition for a non-member are both
    // idempotent: Presence never adds or removes a Membership.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: false, offlineSince: null },
    })
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: 'user-ghost', online: true, offlineSince: null },
    })
    expect(screen.getAllByText('Offline')).toHaveLength(1)
    expect(screen.getAllByText('Online')).toHaveLength(1)
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Ana')).toHaveLength(1)
  })

  it('tells how long a member has been offline and falls back to plain Offline without a known time', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    const minutesAgo = (minutes: number) =>
      new Date(Date.now() - minutes * 60_000 - 10_000).toISOString()

    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({
        presence: [
          { playerId: hostPlayer.id, online: true, offlineSince: null },
          { playerId: guestPlayer.id, online: false, offlineSince: minutesAgo(3) },
        ],
      }),
    })
    expect(await screen.findByText('Offline · 3m ago')).toBeInTheDocument()
    expect(screen.queryByText('Offline')).not.toBeInTheDocument()

    // presence_updated carries the time too, and a member who returns reads Online again.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: true, offlineSince: null },
    })
    await waitFor(() => expect(screen.queryByText(/^Offline/)).not.toBeInTheDocument())
    sendFromServer({
      type: 'presence_updated',
      payload: {
        roomCode: 'LOBBY1',
        playerId: guestPlayer.id,
        online: false,
        offlineSince: minutesAgo(5),
      },
    })
    expect(await screen.findByText('Offline · 5m ago')).toBeInTheDocument()

    // A member the server has no time for reads plain Offline; the client never invents one.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: false, offlineSince: null },
    })
    expect(await screen.findByText('Offline')).toBeInTheDocument()
    expect(screen.queryByText(/Offline ·/)).not.toBeInTheDocument()
  })

  it('shows the overall connection state with accessible text', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')

    expect(screen.getByText('Connecting…')).toBeInTheDocument()

    openLatestWebSocket()
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })
})

describe('squad lobby — readiness from the snapshot', () => {
  it('reveals the invite only when the snapshot carries readiness and locks leaving', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')

    expect(screen.queryByText('Your squad is ready!')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave squad' })).toBeEnabled()

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await screen.findByText('Your squad is ready!')).toBeInTheDocument()
    const joinLink = screen.getByRole('link', { name: 'Join Discord' })
    expect(joinLink).toHaveAttribute('href', 'https://discord.gg/lobby')

    const leaveButton = screen.getByRole('button', { name: 'Squad locked' })
    expect(leaveButton).toBeDisabled()
  })

  it('never reveals the invite for an invalid Discord link', async () => {
    renderSquadsFlow('/squads/BADLNK')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    sendFromServer({
      type: 'room_snapshot',
      payload: readyLobbySnapshot({
        room: { ...invalidDiscordSquad, memberCount: 2, isMember: true },
      }),
    })

    expect(await screen.findByText('Squad locked')).toBeInTheDocument()
    expect(screen.queryByText('Your squad is ready!')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()
  })
})

describe('squad lobby — leave flow', () => {
  it('member leaves over WS + HTTP and lands back on the board', async () => {
    const { navigation, user } = renderSquadsFlow('/squads/LOBBY1', {
      user: { id: 'user-2', name: 'Ana', email: 'ana@squadzr.test', image: null },
    })
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    const lobbySocket = latestWebSocket()
    await waitFor(() =>
      expect(lobbySocket.sentFrames().some((frame) => frame.type === 'join_room')).toBe(true)
    )

    await user.click(screen.getByRole('button', { name: 'Leave squad' }))

    await waitFor(() =>
      expect(lobbySocket.sentFrames().some((frame) => frame.type === 'leave_room')).toBe(true)
    )
    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads'))
    expect(await screen.findByText('Explore squads')).toBeInTheDocument()
    // The title renders while the board's list loads, so the list is awaited.
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
  })

  it('host leave takes the squad off the board', async () => {
    // The host leaving closes the squad: model the server state change so the
    // board refetch no longer returns it.
    const remainingSquads = { rooms: [lobbySquad] }
    onHttp('POST', '/api/rooms/:code/leave', () => {
      remainingSquads.rooms = []
      return httpOk({ ok: true })
    })
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: remainingSquads.rooms }))

    const { navigation, user } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    await user.click(screen.getByRole('button', { name: 'Leave squad' }))

    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads'))
    expect(await screen.findByText('No squads yet')).toBeInTheDocument()
  })
})

describe('squad lobby — server-driven errors and redirects', () => {
  it('shows WS error payloads in a dismissible alert box', async () => {
    const { user } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    sendFromServer({
      type: 'error',
      payload: { code: 'ROOM_FULL', message: 'Join rejected by server' },
    })

    // The alert shows the translation of the code, not the server's English text.
    expect(await screen.findByText('This squad is already full.')).toBeInTheDocument()
    expect(screen.queryByText('Join rejected by server')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(screen.queryByText('This squad is already full.')).not.toBeInTheDocument()
    )
  })

  it('clears the stale lobby state when membership is revoked', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(await screen.findByText('Ana')).toBeInTheDocument()

    sendFromServer({
      type: 'error',
      payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this squad' },
    })

    expect(await screen.findByText('You are not a member of this squad.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument())
    expect(screen.queryByText('Caio')).not.toBeInTheDocument()
    expect(screen.queryByText('2/3 players')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to squads' })).toBeInTheDocument()
  })

  it('recovers the new squad from a delayed error of the previous squad', async () => {
    const nextSquad = {
      ...lobbySquad,
      id: 'aaaaaaaa-0000-4000-8000-000000000007',
      code: 'NEXT01',
      name: 'Next squad',
    }
    onHttp('GET', '/api/rooms/:code', (req) => {
      if (req.params.code === nextSquad.code) {
        return httpOk({ room: nextSquad, players: [hostPlayer] })
      }
      return httpOk(lobbySquadResponse)
    })

    const { navigation } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(await screen.findByText('Ana')).toBeInTheDocument()

    navigation.router.push(`/squads/${nextSquad.code}`)
    await settleNavigation()
    await waitFor(() =>
      expect(serverSentFrames()).toEqual(
        expect.arrayContaining([
          { type: 'leave_room', payload: { roomCode: 'LOBBY1' } },
          { type: 'join_room', payload: { roomCode: nextSquad.code } },
        ])
      )
    )

    // A delayed NOT_ROOM_MEMBER from the previous join arrives with no
    // roomCode to filter on: the authoritative snapshot of the new squad must
    // supersede it instead of leaving the page stuck in the error state.
    sendFromServer({
      type: 'error',
      payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this squad' },
    })
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({
        room: { ...nextSquad, memberCount: 2, isMember: true },
        players: [hostPlayer, guestPlayer],
      }),
    })

    expect(await screen.findByText('Next squad')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
    expect(screen.queryByText('You are not a member of this squad')).not.toBeInTheDocument()
  })

  it('navigates back to the board when the squad is deleted', async () => {
    const { navigation } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    sendFromServer({
      type: 'room_deleted',
      payload: { roomId: lobbySquad.id, roomCode: 'LOBBY1' },
    })

    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads'))
    expect(await screen.findByText('Explore squads')).toBeInTheDocument()
  })
})

describe('squad lobby — failure and access gates', () => {
  it('shows the not-found state for an unknown squad code', async () => {
    renderSquadsFlow('/squads/ZZZZZZ')

    expect(await screen.findByText('Squad not found')).toBeInTheDocument()
    expect(screen.getByText('ZZZZZZ')).toBeInTheDocument()
  })

  it('gates the lobby behind sign-in for guests', async () => {
    renderSquadsFlow('/squads/LOBBY1', { user: null })

    expect(await screen.findByText('Please sign in to view this squad.')).toBeInTheDocument()
  })
})

describe('squad lobby — Ready Squad access gates', () => {
  // A Ready Squad as the server answers a visitor or non-member: the public
  // projection, with no roster, no invite and no readiness.
  const { discordLink: _discordLink, ...publicLobbySquad } = lobbySquad
  const publicReadySquadResponse = {
    room: { ...publicLobbySquad, memberCount: lobbySquad.maxPlayers, isMember: false },
  }

  it('never shows the roster or invite of a Ready Squad to a visitor', async () => {
    onHttp('GET', '/api/rooms/:code', () => httpOk(publicReadySquadResponse))
    renderSquadsFlow('/squads/LOBBY1', { user: null })

    expect(await screen.findByText('Please sign in to view this squad.')).toBeInTheDocument()

    // A visitor never joins the squad channel, so no snapshot can ever arrive.
    openLatestWebSocket()
    expect(latestWebSocket().sentFrames()).toEqual([])

    expect(screen.queryByText('Caio')).not.toBeInTheDocument()
    expect(screen.queryByText('Your squad is ready!')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()
  })

  it('never shows the roster or invite of a Ready Squad to a non-member', async () => {
    onHttp('GET', '/api/rooms/:code', () => httpOk(publicReadySquadResponse))
    renderSquadsFlow('/squads/LOBBY1', {
      user: { id: 'user-7', name: 'Outsider', email: 'outsider@squadzr.test', image: null },
    })
    expect(await screen.findByText('Squad ready check')).toBeInTheDocument()

    openLatestWebSocket()
    sendFromServer({
      type: 'error',
      payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this squad' },
    })

    expect(await screen.findByText('You are not a member of this squad.')).toBeInTheDocument()
    expect(screen.queryByText('Caio')).not.toBeInTheDocument()
    expect(screen.queryByText('Your squad is ready!')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()
  })
})

describe('squad lobby — full reload of a full squad', () => {
  const thirdPlayer = { id: 'user-3', name: 'Bruno', image: null, isHost: false }
  const fullRoster = [hostPlayer, guestPlayer, thirdPlayer]

  function registerFullSquadRoutes(): void {
    onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
    onHttp('GET', '/api/rooms/:code', (req) => {
      if (req.params.code !== lobbySquad.code) {
        return httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
      }
      // HTTP still carries no ready indicator at all.
      return httpOk({ room: lobbySquad, players: fullRoster })
    })
  }

  it('derives readiness and the authorized link from the snapshot alone', async () => {
    registerFullSquadRoutes()

    // Reload: a fresh mount of the lobby; the authoritative HTTP state carries
    // the squad as full but no readiness the client could rehydrate from.
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    const reloadedSocket = latestWebSocket()
    await waitFor(() =>
      expect(reloadedSocket.sentFrames().some((frame) => frame.type === 'join_room')).toBe(true)
    )

    // The server answers the subscription with the complete snapshot: roster,
    // readyAt and the Discord invite in one authoritative message.
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({
        room: { ...lobbySquad, memberCount: fullRoster.length, isMember: true },
        players: fullRoster,
        readyAt: new Date().toISOString(),
        presence: fullRoster.map((player) => ({
          playerId: player.id,
          online: true,
          offlineSince: null,
        })),
      }),
    })

    expect(await screen.findByText('3/3 players')).toBeInTheDocument()
    expect(screen.getByText('Your squad is ready!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Join Discord' })).toHaveAttribute(
      'href',
      'https://discord.gg/lobby'
    )
    expect(screen.getByRole('button', { name: 'Squad locked' })).toBeDisabled()
  })
})
