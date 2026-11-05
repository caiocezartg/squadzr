/**
 * The Player Profile (#114): a dialog the URL carries as `?player=<id>`, opened from a Lobby tile, from
 * "My profile" in the account menu or from a shared link, over whichever page is below it.
 *
 * HTTP runs through the deterministic adapter (./http-router) and the Lobby's WebSocket through the mock
 * socket (./ws-mock), as in the other flow specs.
 */

import { act, screen, waitFor, within } from '@testing-library/react'
import type { PlayerProfileDto } from '@squadzr/schemas'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import {
  boardSquads,
  guestPlayer,
  hostPlayer,
  lobbySnapshot,
  lobbySquad,
  lobbySquadResponse,
  squadReadyNotification,
} from './fixtures'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import { settleNavigation } from './navigation'
import { openLatestWebSocket, sendFromServer } from './ws-flows'

const game = (id: string, name: string) => ({
  id,
  name,
  slug: name.toLowerCase(),
  coverUrl: `https://cdn.squadzr.test/${id}.webp`,
  coverThumbUrl: `https://cdn.squadzr.test/${id}-thumb.webp`,
})
const valorant = game('3fa85f64-5717-4562-b3fc-2c963f66afa6', 'Valorant')
const league = game('7c9e6679-7425-40de-944b-e07fc1f90ae7', 'League of Legends')

const anaProfile: PlayerProfileDto = {
  id: guestPlayer.id,
  name: 'Ana',
  image: null,
  memberSince: '2026-10-05T12:00:00.000Z',
  completedSquads: 20,
  gamesPlayed: 2,
  lastSquad: { game: valorant, readyAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
  topGames: [
    { game: valorant, squads: 12 },
    { game: league, squads: 8 },
  ],
}
const emptyProfile = (id: string, name: string): PlayerProfileDto => ({
  id,
  name,
  image: null,
  memberSince: '2026-10-05T12:00:00.000Z',
  completedSquads: 0,
  gamesPlayed: 0,
  lastSquad: null,
  topGames: [],
})

function registerRoutes(profiles: Record<string, PlayerProfileDto> = {}): void {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [], joined: [] }))
  onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))
  onHttp('GET', '/api/rooms/:code/discord-preview', () => httpOk({ preview: null }))
  onHttp('GET', '/api/notifications', () => httpOk({ notifications: [] }))
  onHttp('GET', '/api/users/:id/profile', (request) => {
    const profile = profiles[request.params.id ?? '']
    return profile
      ? httpOk({ profile })
      : httpError(404, { error: 'USER_NOT_FOUND', message: 'User not found' })
  })
}

async function openLobby(profiles: Record<string, PlayerProfileDto>) {
  registerRoutes(profiles)
  const flow = renderSquadsFlow('/squads/LOBBY1', { shell: true })
  await screen.findByText('Squad ready check')
  openLatestWebSocket()
  sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
  await screen.findByRole('button', { name: "View Ana's profile" })
  return flow
}

const profileDialog = () => screen.findByRole('dialog', { name: /profile/i })

beforeEach(() => {
  registerRoutes()
})

describe('opening the profile', () => {
  it('opens from a Lobby tile over the Lobby, which keeps its live channel', async () => {
    const { user, navigation } = await openLobby({ [guestPlayer.id]: anaProfile })

    await user.click(screen.getByRole('button', { name: "View Ana's profile" }))

    const dialog = await profileDialog()
    expect(dialog).toHaveAccessibleName("Ana's profile")
    expect(navigation.history.location.search).toBe(`?player=${guestPlayer.id}`)
    expect(navigation.history.location.pathname).toBe('/squads/LOBBY1')
    // The page below never navigated: no router call, and the Lobby is still live.
    expect(navigation.calls).toEqual([])
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Ana' })).toBeInTheDocument()
  })

  it('shows the completed Squads, the Games, the last Squad and the ranked Games', async () => {
    const { user } = await openLobby({ [guestPlayer.id]: anaProfile })

    await user.click(screen.getByRole('button', { name: "View Ana's profile" }))

    const dialog = await profileDialog()
    expect(await within(dialog).findByText('20')).toBeInTheDocument()
    expect(within(dialog).getByText('completed')).toBeInTheDocument()
    expect(within(dialog).getByText('2d ago')).toBeInTheDocument()
    expect(within(dialog).getByText(/^Member since .*2026$/)).toBeInTheDocument()
    const ranked = within(within(dialog).getByRole('region', { name: 'Most played' }))
    const rows = ranked.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByText('Valorant')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('12')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('League of Legends')).toBeInTheDocument()
  })

  it('opens from a tile of the Lobby a non-member sees too', async () => {
    registerRoutes({ [guestPlayer.id]: anaProfile })
    const { discordLink: _discordLink, ...publicFields } = lobbySquad
    onHttp('GET', '/api/rooms/:code', () =>
      httpOk({
        room: {
          ...publicFields,
          memberCount: 2,
          isMember: false,
          memberPreview: [
            { id: hostPlayer.id, name: hostPlayer.name, image: hostPlayer.image },
            { id: guestPlayer.id, name: guestPlayer.name, image: guestPlayer.image },
          ],
        },
      })
    )
    const { user } = renderSquadsFlow('/squads/LOBBY1', {
      shell: true,
      user: { id: 'user-7', name: 'Outsider', email: 'outsider@squadzr.test', image: null },
    })

    await user.click(await screen.findByRole('button', { name: "View Ana's profile" }))

    const dialog = await profileDialog()
    expect(await within(dialog).findByText('20')).toBeInTheDocument()
  })

  it('opens from a shared link over the Squad Board', async () => {
    registerRoutes({ [guestPlayer.id]: anaProfile })
    renderSquadsFlow(`/squads?player=${guestPlayer.id}`, { shell: true })

    const dialog = await profileDialog()

    expect(await within(dialog).findByRole('heading', { name: 'Ana' })).toBeInTheDocument()
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
  })

  it('reads the profile ahead when the pointer reaches the tile', async () => {
    const { user } = await openLobby({ [guestPlayer.id]: anaProfile })

    await user.hover(screen.getByRole('button', { name: "View Ana's profile" }))

    await waitFor(() => expect(countHttpCalls('GET', '/api/users/:id/profile')).toBe(1))
  })
})

describe('closing the profile', () => {
  it('closes with its button and takes the parameter out of the URL', async () => {
    const { user, navigation } = await openLobby({ [guestPlayer.id]: anaProfile })
    await user.click(screen.getByRole('button', { name: "View Ana's profile" }))
    const dialog = await profileDialog()

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(navigation.history.location.search).toBe('')
  })

  it('closes with Back and opens again with Forward', async () => {
    const { user, navigation } = await openLobby({ [guestPlayer.id]: anaProfile })
    await user.click(screen.getByRole('button', { name: "View Ana's profile" }))
    await profileDialog()

    act(() => navigation.history.back())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    act(() => navigation.history.forward())
    expect(await profileDialog()).toBeInTheDocument()
  })

  it('opens again after it was closed', async () => {
    const { user } = await openLobby({ [guestPlayer.id]: anaProfile })
    await user.click(screen.getByRole('button', { name: "View Ana's profile" }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: "View Ana's profile" }))

    expect(await profileDialog()).toBeInTheDocument()
  })

  it('shows a profile already seen at once, with no loading state and no second read', async () => {
    const { user } = await openLobby({ [guestPlayer.id]: anaProfile })
    await user.click(screen.getByRole('button', { name: "View Ana's profile" }))
    await screen.findByText('20')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: "View Ana's profile" }))

    const dialog = await profileDialog()
    expect(within(dialog).getByText('20')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/users/:id/profile')).toBe(1)
  })
})

describe('the account menu', () => {
  it("opens the viewer's own profile", async () => {
    registerRoutes({ 'user-1': { ...anaProfile, id: 'user-1', name: 'Caio' } })
    const { user, navigation } = renderSquadsFlow('/squads', { shell: true })
    await screen.findByText('Ranked grind')

    await user.click(await screen.findByRole('button', { name: /Caio/ }))
    await user.click(await screen.findByRole('button', { name: 'My profile' }))

    const dialog = await profileDialog()
    expect(await within(dialog).findByRole('heading', { name: 'Caio' })).toBeInTheDocument()
    expect(navigation.history.location.search).toBe('?player=user-1')
  })
})

describe('a profile without completed Squads', () => {
  it('invites the viewer to find a squad on their own profile', async () => {
    registerRoutes({ 'user-1': emptyProfile('user-1', 'Caio') })
    const { user, navigation } = renderSquadsFlow('/squads/LOBBY1?player=user-1', { shell: true })

    const dialog = await profileDialog()
    expect(await within(dialog).findByText('No completed squads')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Games show up here when a squad of yours fills every slot.')
    ).toBeInTheDocument()
    expect(within(dialog).queryByText('Squads')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('link', { name: 'Find a squad' }))
    await settleNavigation()

    expect(navigation.history.location.pathname).toBe('/squads')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it("only says so on another person's profile, with no button", async () => {
    registerRoutes({ [guestPlayer.id]: emptyProfile(guestPlayer.id, 'Ana') })
    renderSquadsFlow(`/squads?player=${guestPlayer.id}`, { shell: true })

    const dialog = await profileDialog()

    expect(await within(dialog).findByText("Ana hasn't completed a squad yet.")).toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'Find a squad' })).not.toBeInTheDocument()
  })
})

describe('a profile that cannot be shown', () => {
  it('says the player was not found, and the Close button leaves the profile', async () => {
    registerRoutes({})
    const { user, navigation } = renderSquadsFlow('/squads?player=ghost', { shell: true })

    const dialog = await profileDialog()
    expect(await within(dialog).findByText('Player not found')).toBeInTheDocument()
    expect(
      within(dialog).getByText("This profile doesn't exist or was removed.")
    ).toBeInTheDocument()
    // The board below keeps working.
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()

    const closeButtons = within(dialog).getAllByRole('button', { name: 'Close' })
    await user.click(closeButtons[closeButtons.length - 1]!)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(navigation.history.location.search).toBe('')
  })

  it('offers another try when the read fails', async () => {
    let failing = true
    onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
    onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [], joined: [] }))
    onHttp('GET', '/api/notifications', () => httpOk({ notifications: [] }))
    onHttp('GET', '/api/users/:id/profile', () =>
      failing
        ? httpError(500, { error: 'INTERNAL_SERVER_ERROR', message: 'Boom' })
        : httpOk({ profile: anaProfile })
    )
    const { user } = renderSquadsFlow(`/squads?player=${guestPlayer.id}`, { shell: true })
    const dialog = await profileDialog()
    // The read is retried once before the failure shows, so this waits past the retry's pause.
    expect(
      await within(dialog).findByText("Couldn't load this profile", {}, { timeout: 3000 })
    ).toBeInTheDocument()

    failing = false
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }))

    expect(await within(dialog).findByText('20')).toBeInTheDocument()
  })

  it('shows the skeleton while a profile nobody read before is on its way', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
    onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [], joined: [] }))
    onHttp('GET', '/api/notifications', () => httpOk({ notifications: [] }))
    onHttp('GET', '/api/users/:id/profile', async () => {
      await gate
      return httpOk({ profile: anaProfile })
    })
    renderSquadsFlow(`/squads?player=${guestPlayer.id}`, { shell: true })

    const dialog = await profileDialog()
    expect(within(dialog).getByRole('status', { name: 'Loading the profile' })).toBeInTheDocument()

    release?.()
    expect(await within(dialog).findByText('20')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('a Squad that fills', () => {
  it("reads the viewer's profile again when its notification is pushed", async () => {
    registerRoutes()
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['player-profile', 'user-1'], emptyProfile('user-1', 'Caio'))
    queryClient.setQueryData(['player-profile', guestPlayer.id], anaProfile)
    renderSquadsFlow('/squads', { queryClient })
    await screen.findByText('Ranked grind')
    openLatestWebSocket()

    sendFromServer({ type: 'notification', payload: { notification: squadReadyNotification } })

    await waitFor(() =>
      expect(queryClient.getQueryState(['player-profile', 'user-1'])?.isInvalidated).toBe(true)
    )
    // Someone else's profile is not the viewer's to refresh.
    expect(queryClient.getQueryState(['player-profile', guestPlayer.id])?.isInvalidated).toBe(false)
  })
})
