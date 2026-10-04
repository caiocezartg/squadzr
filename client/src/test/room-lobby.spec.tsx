/**
 * Characterization tests for the room lobby page (`/rooms/$code`) after the
 * typed realtime client (CCC-38).
 *
 * The roster, readiness, Presence and the authorized Discord link come only
 * from the WebSocket room snapshot and the events that follow it. HTTP room
 * data supplies static metadata and never overwrites live state, so the old
 * HTTP/WS race (`playersInitialized`) is gone.
 *
 * Covers the snapshot handshake, duplicate snapshots, Presence, the Discord
 * invite disclosure gated by snapshot readiness, the leave flow (member and
 * host), deletion/redirect events, error presentation (inline AlertBox,
 * room-not-found) and the signed-out gate.
 *
 * HTTP runs through the deterministic adapter (./http-router) and WebSocket
 * through the mock socket (./ws-mock). No test touches private hook state.
 */

import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderRoomsFlow } from './harness'
import { httpError, httpOk, onHttp } from './http-router'
import {
  catalogGames,
  catalogRooms,
  gameLol,
  guestPlayer,
  hostPlayer,
  invalidDiscordRoom,
  invalidDiscordRoomResponse,
  lobbyRoom,
  lobbyRoomResponse,
  lobbySnapshot,
  readyLobbySnapshot,
} from './fixtures'
import { openLatestWebSocket, sendFromServer, serverSentFrames } from './ws-flows'
import { latestWebSocket } from './ws-mock'

function registerLobbyRoutes(): void {
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
  onHttp('GET', '/api/rooms/:code', (req) => {
    if (req.params.code === lobbyRoom.code) return httpOk(lobbyRoomResponse)
    if (req.params.code === invalidDiscordRoom.code) {
      return httpOk(invalidDiscordRoomResponse)
    }
    return httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
  })
  onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
  onHttp('POST', '/api/rooms/:code/join', () => httpOk({ ok: true }))
  onHttp('POST', '/api/rooms/:code/leave', () => httpOk({ ok: true }))
}

beforeEach(() => {
  registerLobbyRoutes()
})

describe('room lobby — snapshot handshake', () => {
  it('joins the room over WebSocket and renders the roster from the snapshot', async () => {
    renderRoomsFlow('/rooms/LOBBY1')

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
    renderRoomsFlow('/rooms/LOBBY1')
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
        presence: [{ playerId: hostPlayer.id, online: true }],
      }),
    })
    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument())
    expect(screen.getByText('1/3 players')).toBeInTheDocument()
  })

  it('renders Presence from the snapshot and applies presence_updated without adding members', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(await screen.findByText('Ana')).toBeInTheDocument()

    // Presence never relies on color alone: each member has a title and an
    // accessible Online/Offline label.
    expect(screen.getAllByTitle('Online')).toHaveLength(1)
    expect(screen.getAllByTitle('Offline')).toHaveLength(1)
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()

    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: true },
    })
    await waitFor(() => expect(screen.getAllByTitle('Online')).toHaveLength(2))

    // The server owns the aggregation (multiple sessions, grace window): the
    // client applies the boolean it receives in both directions.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: false },
    })
    await waitFor(() => expect(screen.getAllByTitle('Offline')).toHaveLength(1))
    expect(screen.getAllByTitle('Online')).toHaveLength(1)

    // A duplicate transition and a transition for a non-member are both
    // idempotent: Presence never adds or removes a Membership.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: false },
    })
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: 'user-ghost', online: true },
    })
    expect(screen.getAllByTitle('Offline')).toHaveLength(1)
    expect(screen.getAllByTitle('Online')).toHaveLength(1)
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Ana')).toHaveLength(1)
  })

  it('shows the overall connection state with accessible text', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')

    expect(screen.getByText('Connecting…')).toBeInTheDocument()

    openLatestWebSocket()
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })
})

describe('room lobby — readiness from the snapshot', () => {
  it('reveals the invite only when the snapshot carries readiness and locks leaving', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
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
    renderRoomsFlow('/rooms/BADLNK')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    sendFromServer({
      type: 'room_snapshot',
      payload: readyLobbySnapshot({
        room: { ...invalidDiscordRoom, memberCount: 2, isMember: true },
      }),
    })

    expect(await screen.findByText('Squad locked')).toBeInTheDocument()
    expect(screen.queryByText('Your squad is ready!')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()
  })
})

describe('room lobby — leave flow', () => {
  it('member leaves over WS + HTTP and lands back on the catalog', async () => {
    const { router, user } = renderRoomsFlow('/rooms/LOBBY1', {
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
    await waitFor(() => expect(router.history.location.pathname).toBe('/rooms'))
    expect(await screen.findByText('Explore squads')).toBeInTheDocument()
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
  })

  it('host leave takes the room out of the catalog', async () => {
    // The host leaving closes the room: model the server state change so the
    // catalog refetch no longer returns it.
    const remainingRooms = { rooms: [lobbyRoom] }
    onHttp('POST', '/api/rooms/:code/leave', () => {
      remainingRooms.rooms = []
      return httpOk({ ok: true })
    })
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: remainingRooms.rooms }))

    const { router, user } = renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    await user.click(screen.getByRole('button', { name: 'Leave squad' }))

    await waitFor(() => expect(router.history.location.pathname).toBe('/rooms'))
    expect(await screen.findByText('No squads yet')).toBeInTheDocument()
  })
})

describe('room lobby — server-driven errors and redirects', () => {
  it('shows WS error payloads in a dismissible alert box', async () => {
    const { user } = renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    sendFromServer({
      type: 'error',
      payload: { code: 'ROOM_FULL', message: 'Join rejected by server' },
    })

    expect(await screen.findByText('Join rejected by server')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(screen.queryByText('Join rejected by server')).not.toBeInTheDocument()
    )
  })

  it('clears the stale lobby state when membership is revoked', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    expect(await screen.findByText('Ana')).toBeInTheDocument()

    sendFromServer({
      type: 'error',
      payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this squad' },
    })

    expect(await screen.findByText('You are not a member of this squad')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument())
    expect(screen.queryByText('Caio')).not.toBeInTheDocument()
    expect(screen.queryByText('2/3 players')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to squads' })).toBeInTheDocument()
  })

  it('navigates back to the catalog when the room is deleted', async () => {
    const { router } = renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    sendFromServer({
      type: 'room_deleted',
      payload: { roomId: lobbyRoom.id, roomCode: 'LOBBY1' },
    })

    await waitFor(() => expect(router.history.location.pathname).toBe('/rooms'))
    expect(await screen.findByText('Explore squads')).toBeInTheDocument()
  })
})

describe('room lobby — failure and access gates', () => {
  it('shows the not-found state for an unknown room code', async () => {
    renderRoomsFlow('/rooms/ZZZZZZ')

    expect(await screen.findByText('Squad not found')).toBeInTheDocument()
    expect(screen.getByText('ZZZZZZ')).toBeInTheDocument()
  })

  it('gates the lobby behind sign-in for guests', async () => {
    renderRoomsFlow('/rooms/LOBBY1', { user: null })

    expect(await screen.findByText('Please sign in to view this squad.')).toBeInTheDocument()
  })
})

describe('room lobby — full reload of a full room', () => {
  const thirdPlayer = { id: 'user-3', name: 'Bruno', image: null, isHost: false }
  const fullRoster = [hostPlayer, guestPlayer, thirdPlayer]

  function registerFullRoomRoutes(): void {
    onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
    onHttp('GET', '/api/games', () => httpOk(catalogGames))
    onHttp('GET', '/api/rooms/:code', (req) => {
      if (req.params.code !== lobbyRoom.code) {
        return httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
      }
      // HTTP still carries no ready indicator at all.
      return httpOk({ room: lobbyRoom, players: fullRoster })
    })
    onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
  }

  it('derives readiness and the authorized link from the snapshot alone', async () => {
    registerFullRoomRoutes()

    // Reload: a fresh mount of the lobby; the authoritative HTTP state carries
    // the room as full but no readiness the client could rehydrate from.
    renderRoomsFlow('/rooms/LOBBY1')
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
        room: { ...lobbyRoom, memberCount: fullRoster.length, isMember: true },
        players: fullRoster,
        readyAt: new Date().toISOString(),
        presence: fullRoster.map((player) => ({ playerId: player.id, online: true })),
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
