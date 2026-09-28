/**
 * Characterization tests for the room lobby page (`/rooms/$code`).
 *
 * Covers the roster initialization from HTTP, the WebSocket join handshake
 * and roster events, the Discord invite disclosure gated by `room_ready`,
 * the leave flow (member and host), deletion/redirect events, error
 * presentation (inline AlertBox, room-not-found) and the signed-out gate.
 *
 * The last test characterizes a FULL reload of a full room, reproducing the
 * real server flow: HTTP serves the room already full but with NO ready
 * indicator, the WS handshake replays `room_joined` with the complete roster,
 * and the server re-emits `room_ready` (broadcastRoomReadyIfFull) on every
 * `join_room` of a full room. The ready UI after reload therefore exists ONLY
 * because of that event re-emission — not because the client derives
 * readiness from authoritative state (HTTP/snapshot). Recorded for CCC-32 as
 * behavior to fix in CCC-39 (migrate the lobby into a capability module),
 * NOT as a future invariant.
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

describe('room lobby — roster initialization and WS handshake', () => {
  it('renders the roster from HTTP and joins the room over WebSocket', async () => {
    renderRoomsFlow('/rooms/LOBBY1')

    expect(await screen.findByText('Squad ready check')).toBeInTheDocument()
    expect(screen.getByText('Caio')).toBeInTheDocument()
    expect(screen.getByText('1/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for player...')).toHaveLength(2)
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
  })

  it('applies roster events: room_joined, player_joined (deduped) and player_left', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Caio')

    openLatestWebSocket()
    sendFromServer({
      type: 'room_joined',
      payload: {
        roomId: lobbyRoom.id,
        roomCode: 'LOBBY1',
        players: [hostPlayer, guestPlayer],
      },
    })
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('2/3 players')).toBeInTheDocument()

    sendFromServer({ type: 'player_joined', payload: { player: guestPlayer } })
    expect(screen.getAllByText('Ana')).toHaveLength(1)

    const third = { id: 'user-3', name: 'Bruno', image: null, isHost: false }
    sendFromServer({ type: 'player_joined', payload: { player: third } })
    expect(await screen.findByText('Bruno')).toBeInTheDocument()
    expect(screen.getByText('3/3 players')).toBeInTheDocument()

    sendFromServer({ type: 'player_left', payload: { playerId: guestPlayer.id } })
    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument())
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
  })
})

describe('room lobby — Discord disclosure on room_ready', () => {
  it('reveals the invite only after the room becomes ready and locks leaving', async () => {
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')

    expect(screen.queryByText('Your squad is ready!')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Join Discord' })).not.toBeInTheDocument()

    openLatestWebSocket()
    sendFromServer({
      type: 'room_ready',
      payload: { roomId: lobbyRoom.id, roomCode: 'LOBBY1', message: 'ready' },
    })

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
      type: 'room_ready',
      payload: {
        roomId: invalidDiscordRoom.id,
        roomCode: 'BADLNK',
        message: 'ready',
      },
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
    await screen.findByText('Caio')

    openLatestWebSocket()
    sendFromServer({
      type: 'error',
      payload: { code: 'ROOM_NOT_WAITING', message: 'Join rejected by server' },
    })

    expect(await screen.findByText('Join rejected by server')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(screen.queryByText('Join rejected by server')).not.toBeInTheDocument()
    )
  })

  it('navigates back to the catalog when the room is deleted', async () => {
    const { router } = renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Caio')

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

describe('room lobby — full reload after room_ready (recorded for CCC-39)', () => {
  // Server truth (characterized here, read-only): on EVERY `join_room` the
  // server re-emits `room_ready` when the room is full
  // (server/src/infrastructure/websocket/handlers/room.handler.ts →
  // broadcastRoomReadyIfFull). A real reload of a full room is therefore:
  // HTTP returns the full room (with NO ready indicator the client can
  // rehydrate from), the WS handshake replays `room_joined` with the complete
  // roster from the DB, and the server re-emits `room_ready`. The ready UI
  // after reload exists ONLY because of that re-emission — not because the
  // client derives readiness from authoritative state (HTTP/snapshot). That
  // gap is the behavior to fix in CCC-39 (lobby capability module); this test
  // records it, it does not endorse it.
  const thirdPlayer = { id: 'user-3', name: 'Bruno', image: null, isHost: false }
  const fullRoster = [hostPlayer, guestPlayer, thirdPlayer]

  function registerFullRoomRoutes(): void {
    onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
    onHttp('GET', '/api/games', () => httpOk(catalogGames))
    onHttp('GET', '/api/rooms/:code', (req) => {
      if (req.params.code !== lobbyRoom.code) {
        return httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
      }
      return httpOk({ room: lobbyRoom, players: fullRoster })
    })
    onHttp('GET', '/api/games/:gameId', () => httpOk({ game: gameLol }))
  }

  it('full reload of a full room regains Discord access only via the re-emitted room_ready (CCC-39)', async () => {
    registerFullRoomRoutes()

    // Reload: a fresh mount of the lobby — the authoritative HTTP state still
    // carries the room as full, but contains no ready indicator at all.
    renderRoomsFlow('/rooms/LOBBY1')
    await screen.findByText('Squad ready check')

    openLatestWebSocket()
    const reloadedSocket = latestWebSocket()
    await waitFor(() =>
      expect(reloadedSocket.sentFrames().some((frame) => frame.type === 'join_room')).toBe(true)
    )

    // Server replays `room_joined` with the complete roster from the DB.
    sendFromServer({
      type: 'room_joined',
      payload: { roomId: lobbyRoom.id, roomCode: 'LOBBY1', players: fullRoster },
    })
    expect(await screen.findByText('3/3 players')).toBeInTheDocument()

    // Transient gap (transitory, recorded): between `room_joined` and the
    // re-emitted `room_ready` the invite is hidden and leaving is still
    // possible — readiness is pure local WS state at this point.
    expect(screen.queryByText('Your squad is ready!')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave squad' })).toBeEnabled()

    // Server re-emits `room_ready` because the room is full
    // (broadcastRoomReadyIfFull) — the invite reappears ONLY thanks to this
    // re-emission, not from the HTTP snapshot. CCC-39 owns the fix.
    sendFromServer({
      type: 'room_ready',
      payload: {
        roomId: lobbyRoom.id,
        roomCode: 'LOBBY1',
        message: 'Room is full! Time to play!',
      },
    })
    expect(await screen.findByText('Your squad is ready!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Squad locked' })).toBeDisabled()
  })
})
