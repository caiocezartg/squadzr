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

import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSquadsFlow } from './harness'
import { expectLockedInvite } from './locked-invite'
import { httpError, httpOk, onHttp } from './http-router'
import { mockMediaQuery } from './media-query'
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

/** The tile of a member, by the name it shows. */
function tileOf(name: string): HTMLElement {
  const tile = screen.getByText(name).closest('li')
  if (!tile) throw new Error(`${name} has no member tile`)
  return tile
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
    expect(screen.getAllByText('Open slot')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'End squad' })).toBeInTheDocument()

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

    // Presence never relies on color alone: each tile says it in words, and the overall connection
    // state has its own text.
    expect(screen.getAllByText('In the room now')).toHaveLength(1)
    expect(screen.getAllByText('Out of the room')).toHaveLength(1)
    expect(screen.getAllByText('Connected')).toHaveLength(1)
    expect(tileOf('Caio')).toHaveAttribute('title', 'In the room now')
    expect(tileOf('Ana')).toHaveAttribute('title', 'Out of the room')

    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: true, offlineSince: null },
    })
    await waitFor(() => expect(screen.getAllByText('In the room now')).toHaveLength(2))

    // The server owns the aggregation (multiple sessions, grace window): the client applies the
    // online flag and offlineSince it receives in both directions.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: false, offlineSince: null },
    })
    await waitFor(() => expect(screen.getAllByText('Out of the room')).toHaveLength(1))
    expect(screen.getAllByText('In the room now')).toHaveLength(1)

    // A duplicate transition and a transition for a non-member are both idempotent: Presence never
    // adds or removes a Membership.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: false, offlineSince: null },
    })
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: 'user-ghost', online: true, offlineSince: null },
    })
    expect(screen.getAllByText('Out of the room')).toHaveLength(1)
    expect(screen.getAllByText('In the room now')).toHaveLength(1)
    expect(screen.getByText('2/3 players')).toBeInTheDocument()
    expect(screen.getAllByText('Ana')).toHaveLength(1)
  })

  it('tells how long a member has been away and falls back to plain "Out of the room" without a known time', async () => {
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
    expect(await screen.findByText('Out of the room · 3m ago')).toBeInTheDocument()
    expect(screen.queryByText('Out of the room')).not.toBeInTheDocument()

    // presence_updated carries the time too, and a member who returns reads in the room again.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: true, offlineSince: null },
    })
    await waitFor(() => expect(screen.queryByText(/^Out of the room/)).not.toBeInTheDocument())
    sendFromServer({
      type: 'presence_updated',
      payload: {
        roomCode: 'LOBBY1',
        playerId: guestPlayer.id,
        online: false,
        offlineSince: minutesAgo(5),
      },
    })
    expect(await screen.findByText('Out of the room · 5m ago')).toBeInTheDocument()

    // A member the server has no time for reads plain "Out of the room"; the client never invents one.
    sendFromServer({
      type: 'presence_updated',
      payload: { roomCode: 'LOBBY1', playerId: guestPlayer.id, online: false, offlineSince: null },
    })
    expect(await screen.findByText('Out of the room')).toBeInTheDocument()
    expect(screen.queryByText(/Out of the room ·/)).not.toBeInTheDocument()
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

    // Forming: the invite is locked and its link is nowhere on the page.
    expect(screen.getByText('Discord invite')).toBeInTheDocument()
    expectLockedInvite()
    expect(screen.queryByRole('heading', { name: "Let's go to Discord" })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open in Discord' })).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('discord.gg/lobby')
    expect(screen.getByRole('button', { name: 'End squad' })).toBeEnabled()

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await screen.findByRole('heading', { name: "Let's go to Discord" })).toBeInTheDocument()
    expect(screen.getByText('SQUAD CLOSED')).toBeInTheDocument()
    expect(screen.queryByText('Unlocked when the squad completes')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open in Discord' })).toHaveAttribute(
      'href',
      'https://discord.gg/lobby'
    )

    const leaveButton = screen.getByRole('button', { name: 'Team closed' })
    expect(leaveButton).toBeDisabled()
  })

  it('names the locked invite bar as a region, like the Ready panel', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')

    // The bar is a region named by its heading, with its lock, its wait and its masked link.
    expectLockedInvite()
  })

  it('builds the server card of the Ready panel from the snapshot: name, cover, who is in the room, players', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    sendFromServer({
      type: 'room_snapshot',
      payload: readyLobbySnapshot({
        presence: [
          { playerId: hostPlayer.id, online: true, offlineSince: null },
          { playerId: guestPlayer.id, online: false, offlineSince: null },
        ],
      }),
    })

    const panel = (await screen.findByRole('heading', { name: "Let's go to Discord" })).closest(
      'section'
    )
    if (!panel) throw new Error('The Ready panel is not a section')
    const inPanel = within(panel)
    expect(inPanel.getByText('SERVER INVITE')).toBeInTheDocument()
    expect(inPanel.getByText('Squad ready check')).toBeInTheDocument()
    expect(inPanel.getByText('1 in the room now')).toBeInTheDocument()
    expect(inPanel.getByText('2 players')).toBeInTheDocument()
    expect(panel.querySelector('img')).toHaveAttribute('src', lobbySquad.game.coverUrl)
    expect(inPanel.getByText('discord.gg/')).toBeInTheDocument()
  })

  it('enters the panel for a viewer who watched the Squad complete, and not for one who opens it Ready', async () => {
    const { unmount } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')
    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    const watched = (await screen.findByRole('heading', { name: "Let's go to Discord" })).closest(
      'section'
    )
    expect(watched).toHaveClass('motion-safe:animate-invite-enter')
    unmount()

    // A cold open of the Squad that is already Ready is the room as it was: the panel is simply there.
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    const cold = (await screen.findByRole('heading', { name: "Let's go to Discord" })).closest(
      'section'
    )
    expect(cold).not.toHaveClass('motion-safe:animate-invite-enter')
    expect(cold).not.toHaveClass('motion-reduce:animate-invite-fade')
  })

  it('opens the invite in a new tab without handing the opener over', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    const link = await screen.findByRole('link', { name: 'Open in Discord' })

    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('copies the invite and says "Copied" until the confirmation runs out', async () => {
    const { user } = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    await user.click(await screen.findByRole('button', { name: 'Copy link' }))

    expect(await navigator.clipboard.readText()).toBe('https://discord.gg/lobby')
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument(),
      { timeout: 3_000 }
    )
  })

  it('unlocks the invite for a viewer who prefers reduced motion, watching the Squad complete', async () => {
    mockMediaQuery('(prefers-reduced-motion: reduce)', true)
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
    await screen.findByText('Ana')
    expectLockedInvite()

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    // The panel is there, whole and usable, whether or not it moves in.
    const panel = (await screen.findByRole('heading', { name: "Let's go to Discord" })).closest(
      'section'
    )
    expect(panel).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open in Discord' })).toBeVisible()
    expect(screen.queryByText('Unlocked when the squad completes')).not.toBeInTheDocument()
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

    expect(await screen.findByRole('button', { name: 'Team closed' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: "Let's go to Discord" })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open in Discord' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('not-discord.example')
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

  it('opens the public view, not the member Lobby, when the viewer goes back to a Squad they left', async () => {
    let left = false
    const { discordLink: _discordLink, ...publicFields } = lobbySquad
    onHttp('GET', '/api/rooms/:code', () =>
      left
        ? httpOk({ room: { ...publicFields, memberCount: 1, isMember: false } })
        : httpOk(lobbySquadResponse)
    )
    onHttp('POST', '/api/rooms/:code/leave', () => {
      left = true
      return httpOk({ ok: true })
    })
    const { navigation, user } = renderSquadsFlow('/squads/LOBBY1', {
      user: { id: 'user-2', name: 'Ana', email: 'ana@squadzr.test', image: null },
    })
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    await user.click(screen.getByRole('button', { name: 'Leave squad' }))
    await waitFor(() => expect(navigation.history.location.pathname).toBe('/squads'))

    // Back within the minute the details stay fresh: they must already say the viewer left.
    navigation.router.push('/squads/LOBBY1')
    await settleNavigation()

    expect(await screen.findByRole('button', { name: 'Join squad' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave squad' })).not.toBeInTheDocument()
    expect(screen.queryByText('You are not a member of this squad.')).not.toBeInTheDocument()
    openLatestWebSocket()
    expect(latestWebSocket().sentFrames()).toEqual([])
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

    const { navigation, user } = renderSquadsFlow('/squads/LOBBY1', { shell: true })
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    await user.click(screen.getByRole('button', { name: 'End squad' }))

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
  // The server answers a visitor or a non-member for a Ready Squad as it does for a missing one.
  const notFoundBody = { message: 'Squad not found', error: 'ROOM_NOT_FOUND' }

  it('never shows a Ready Squad to a visitor', async () => {
    onHttp('GET', '/api/rooms/:code', () => httpError(404, notFoundBody))
    renderSquadsFlow('/squads/LOBBY1', { user: null })

    expect(await screen.findByText('Please sign in to view this squad.')).toBeInTheDocument()

    // A visitor never joins the squad channel, so no snapshot can ever arrive.
    openLatestWebSocket()
    expect(latestWebSocket().sentFrames()).toEqual([])

    expect(screen.queryByText('Caio')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: "Let's go to Discord" })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open in Discord' })).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('discord.gg/lobby')
  })

  it('never shows a Ready Squad to a non-member', async () => {
    onHttp('GET', '/api/rooms/:code', () => httpError(404, notFoundBody))
    renderSquadsFlow('/squads/LOBBY1', {
      user: { id: 'user-7', name: 'Outsider', email: 'outsider@squadzr.test', image: null },
    })

    expect(await screen.findByText('Squad not found')).toBeInTheDocument()

    // The read said the Squad is not the viewer's to see, so the page never joins its squad channel.
    openLatestWebSocket()
    expect(latestWebSocket().sentFrames()).toEqual([])

    expect(screen.queryByText('Caio')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: "Let's go to Discord" })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open in Discord' })).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('discord.gg/lobby')
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
    expect(screen.getByRole('heading', { name: "Let's go to Discord" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open in Discord' })).toHaveAttribute(
      'href',
      'https://discord.gg/lobby'
    )
    expect(screen.getByRole('button', { name: 'Team closed' })).toBeDisabled()
  })
})

describe('squad lobby — the member Lobby', () => {
  const thirdPlayer = { id: 'user-3', name: 'Bruno', image: null, isHost: false }

  // The reduced-motion case spies on matchMedia; the cases after it run under full motion again.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** A squad of ten with `count` members, the host first, as the server orders them. */
  function bigSquadSnapshot(count: number) {
    const players = [
      hostPlayer,
      ...Array.from({ length: count - 1 }, (_, index) => ({
        id: `user-m${index}`,
        name: `Member ${index + 1}`,
        image: null,
        isHost: false,
      })),
    ]
    return lobbySnapshot({
      room: { ...lobbySquad, maxPlayers: 10, memberCount: count, isMember: true },
      players,
      presence: players.map((player) => ({
        playerId: player.id,
        online: true,
        offlineSince: null,
      })),
    })
  }

  async function renderLobbyWithSnapshot(snapshot = lobbySnapshot()) {
    const flow = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: snapshot })
    await screen.findByText(snapshot.players[0]?.name ?? '')
    return flow
  }

  it('shows the cover panel and the header actions', async () => {
    await renderLobbyWithSnapshot()

    expect(screen.getByRole('heading', { level: 1, name: 'Squad ready check' })).toBeInTheDocument()
    expect(screen.getByText('League of Legends')).toBeInTheDocument()
    expect(screen.getByText('EN-US')).toBeInTheDocument()
    expect(screen.getByText('#squad')).toBeInTheDocument()
    expect(screen.getByText(/^Created /)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explore squads' })).toHaveAttribute('href', '/squads')
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('counts the members as 02/03 and swaps the count when a snapshot changes it', async () => {
    await renderLobbyWithSnapshot()

    expect(screen.getByText('2/3 players').parentElement).toHaveTextContent('02/03')

    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({ players: [hostPlayer, guestPlayer, thirdPlayer], presence: [] }),
    })

    await waitFor(() =>
      expect(screen.getByText('3/3 players').parentElement).toHaveTextContent('03/03')
    )
  })

  it('lists the members in the server order, marks the viewer, and fills the rest with open slots', async () => {
    await renderLobbyWithSnapshot()

    const tiles = screen.getAllByRole('listitem')
    expect(tiles).toHaveLength(3)
    expect(tiles[0]).toHaveTextContent('Caio')
    expect(within(tileOf('Caio')).getByText('you')).toBeInTheDocument()
    expect(tiles[1]).toHaveTextContent('Ana')
    expect(within(tileOf('Ana')).queryByText('you')).not.toBeInTheDocument()
    expect(tiles[2]).toHaveTextContent('Open slot')
  })

  it('reads online and away members in words, with the time away when it is known', async () => {
    const away = new Date(Date.now() - 7 * 60_000 - 10_000).toISOString()
    await renderLobbyWithSnapshot(
      lobbySnapshot({
        presence: [
          { playerId: hostPlayer.id, online: true, offlineSince: null },
          { playerId: guestPlayer.id, online: false, offlineSince: away },
        ],
      })
    )

    expect(tileOf('Caio')).toHaveTextContent('In the room now')
    expect(tileOf('Ana')).toHaveTextContent('Out of the room · 7m ago')
  })

  it('pages the members eight to a page, the open slots after the last member', async () => {
    const { user } = await renderLobbyWithSnapshot(bigSquadSnapshot(9))

    expect(screen.getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByText('Member 7')).toBeInTheDocument()
    expect(screen.queryByText('Member 8')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: 'Page 2' }))

    const tiles = screen.getAllByRole('listitem')
    expect(tiles).toHaveLength(2)
    expect(tiles[0]).toHaveTextContent('Member 8')
    expect(tiles[1]).toHaveTextContent('Open slot')
  })

  it('does not animate the first snapshot, and enters a member of a later one from opacity 0 and scale 0.9', async () => {
    await renderLobbyWithSnapshot()

    // The first snapshot renders its tiles in their final state: nothing starts from the entrance state.
    expect(tileOf('Ana').style.opacity).toBe('1')

    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({ players: [hostPlayer, guestPlayer, thirdPlayer] }),
    })
    await screen.findByText('Bruno')

    // The entrance has started: the tile is on its way from opacity 0 and scale(0.9).
    expect(Number(tileOf('Bruno').style.opacity)).toBeLessThan(0.5)
    expect(tileOf('Bruno').style.transform).toMatch(/^scale\(0\.9/)
    expect(tileOf('Ana').style.opacity).toBe('1')
    await waitFor(() => expect(tileOf('Bruno').style.opacity).toBe('1'))
  })

  it('does not replay an entrance when the viewer pages away and back', async () => {
    const { user } = await renderLobbyWithSnapshot(bigSquadSnapshot(7))

    sendFromServer({ type: 'room_snapshot', payload: bigSquadSnapshot(8) })
    await screen.findByText('Member 7')
    await waitFor(() => expect(tileOf('Member 7').style.opacity).toBe('1'))

    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    await user.click(screen.getByRole('button', { name: 'Page 1' }))

    // Back on page 1 the tile is already in its final state: it does not start from opacity 0 again.
    expect(tileOf('Member 7').style.opacity).toBe('1')
  })

  it('enters a new member with the fade alone under reduced motion, ending in the final state', async () => {
    mockMediaQuery('(prefers-reduced-motion: reduce)', true)
    await renderLobbyWithSnapshot()

    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({ players: [hostPlayer, guestPlayer, thirdPlayer] }),
    })
    await screen.findByText('Bruno')

    expect(tileOf('Bruno').style.transform).toBe('')
    await waitFor(() => expect(tileOf('Bruno').style.opacity).toBe('1'))
    expect(tileOf('Bruno')).toBeVisible()
  })

  it('turns the code button into "Copied" after copying the code, then back', async () => {
    const { user } = await renderLobbyWithSnapshot()

    await user.click(screen.getByRole('button', { name: 'Copy code LOBBY1' }))

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe('LOBBY1')
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Copy code LOBBY1' })).toBeInTheDocument(),
      { timeout: 3_000 }
    )
  })

  it('copies the squad link from the header', async () => {
    const { user } = await renderLobbyWithSnapshot()

    await user.click(screen.getByRole('button', { name: 'Copy squad link' }))

    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/squads/LOBBY1`)
  })

  it('offers the host "End squad", and closes it once the Squad is Ready', async () => {
    await renderLobbyWithSnapshot()

    expect(screen.getByRole('button', { name: 'End squad' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Leave squad' })).not.toBeInTheDocument()

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await screen.findByRole('button', { name: 'Team closed' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'End squad' })).not.toBeInTheDocument()
  })

  it('keeps Presence frozen while the connection is down', async () => {
    const away = new Date(Date.now() - 3 * 60_000 - 10_000).toISOString()
    await renderLobbyWithSnapshot(
      lobbySnapshot({
        presence: [
          { playerId: hostPlayer.id, online: true, offlineSince: null },
          { playerId: guestPlayer.id, online: false, offlineSince: away },
        ],
      })
    )

    act(() => latestWebSocket().close(1006))

    expect(await screen.findByText('Reconnecting…')).toBeInTheDocument()
    expect(tileOf('Caio')).toHaveTextContent('In the room now')
    expect(tileOf('Ana')).toHaveTextContent('Out of the room · 3m ago')
  })
})
