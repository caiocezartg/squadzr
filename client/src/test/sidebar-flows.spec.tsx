/**
 * The flows of the sidebar shell (CCC-106): the squad count, "Create squad" on the board and in the
 * Lobby, `?create=1`, the visitor's `?join=` prompt, the code form, the language switch, the drawer
 * below 1024px, the one bell, and warm-cache navigation between the pages.
 */

import { act, screen, waitFor, within } from '@testing-library/react'
import { focusManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WIDE_QUERY } from '@/components/layout/wide-query'
import { LOCALE_COOKIE } from '@/i18n/locales'
import { squadQueryKey } from '@/features/lobby/squad-details'
import {
  boardGames,
  boardSquads,
  lobbySquad,
  lobbySquadResponse,
  openSquad,
  squadReadyNotification,
} from './fixtures'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import type { RenderSquadsFlowOptions } from './harness'
import { countHttpCalls, httpOk, onHttp } from './http-router'
import { mockMediaQuery } from './media-query'
import { authStore } from './stubs'
import type { RoomsResponse } from '@/types'

function registerRoutes(rooms: RoomsResponse = boardSquads): void {
  onHttp('GET', '/api/rooms', () => httpOk(rooms))
  onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))
  onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [], joined: [] }))
  onHttp('POST', '/api/rooms/:code/join', () => httpOk({ ok: true }))
  onHttp('GET', '/api/notifications', () => httpOk({ notifications: [] }))
  onHttp('GET', '/api/games', (request) => {
    const search = request.query.get('search')?.trim().toLowerCase() ?? ''
    return httpOk({
      games: boardGames.games.filter((game) => game.name.toLowerCase().includes(search)),
    })
  })
}

function renderShell(url: string, options: Omit<RenderSquadsFlowOptions, 'shell'> = {}) {
  return renderSquadsFlow(url, { shell: true, ...options })
}

/** The sidebar column: the shell's complementary landmark. */
function sidebar() {
  return within(screen.getByRole('complementary', { name: 'Menu' }))
}

beforeEach(() => {
  registerRoutes()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`
})

describe('the squad count', () => {
  it('is the length of the unfiltered board list, whatever the board filters', async () => {
    renderShell('/squads?search=nothing-matches-this')

    expect(await sidebar().findByText(String(boardSquads.rooms.length))).toBeInTheDocument()
    expect(await screen.findByText('No squads found')).toBeInTheDocument()
  })

  it('moves with the board list while the board is open', async () => {
    const queryClient = createTestQueryClient()
    renderShell('/squads', { queryClient })
    await sidebar().findByText('3')

    act(() => queryClient.setQueryData(['squads'], { rooms: [openSquad] }))

    expect(await sidebar().findByText('1')).toBeInTheDocument()
  })

  it('reads the list again when the window regains focus', async () => {
    const queryClient = createTestQueryClient()
    renderShell('/squads', { queryClient })
    await sidebar().findByText('3')
    registerRoutes({ rooms: [openSquad] })
    // The list is fresh for a minute, so the focus read applies to a list that went stale.
    await act(() => queryClient.invalidateQueries({ queryKey: ['squads'], refetchType: 'none' }))

    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    expect(await sidebar().findByText('1')).toBeInTheDocument()
    focusManager.setFocused(undefined)
  })

  it('reads the list again when the viewer navigates to another page', async () => {
    const { navigation } = renderShell('/squads')
    await sidebar().findByText('3')
    const readsBefore = countHttpCalls('GET', '/api/rooms')
    registerRoutes({ rooms: [openSquad] })

    act(() => navigation.history.push('/'))

    expect(await sidebar().findByText('1')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBeGreaterThan(readsBefore)
  })
})

describe('Create squad', () => {
  it('opens the create dialog on the board, with its form and no loading state', async () => {
    const { user } = renderShell('/squads')
    await screen.findByText('Ranked grind')

    await user.click(sidebar().getByRole('button', { name: 'Create squad' }))

    expect(await screen.findByText('Create a Squad')).toBeInTheDocument()
    expect(screen.getByLabelText('Squad Name')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('opens the same dialog in the Lobby', async () => {
    const { user } = renderShell(`/squads/${lobbySquad.code}`)

    await user.click(sidebar().getByRole('button', { name: 'Create squad' }))

    expect(await screen.findByText('Create a Squad')).toBeInTheDocument()
    expect(screen.getByLabelText('Squad Name')).toBeInTheDocument()
  })

  it('asks a visitor to sign in and returns to the same page with the create request', async () => {
    const { user } = renderShell('/squads?search=ranked', { user: null })
    await screen.findByText('Ranked grind')

    await user.click(sidebar().getByRole('button', { name: 'Create squad' }))
    expect(await screen.findByText('Sign in required')).toBeInTheDocument()
    expect(screen.getByText(/creating a squad requires signing in/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue with Discord' }))

    expect(authStore.signInSocialCalls).toEqual([
      {
        provider: 'discord',
        callbackURL: `${window.location.origin}/squads?search=ranked&create=1`,
      },
    ])
  })
})

describe('?create=1', () => {
  it('opens the create dialog on load and drops the parameter', async () => {
    const { navigation } = renderShell('/squads?create=1')

    expect(await screen.findByText('Create a Squad')).toBeInTheDocument()
    await waitFor(() => expect(navigation.history.location.search).toBe(''))
    expect(navigation.history.location.pathname).toBe('/squads')
  })

  it('keeps the other parameters of the URL when it drops the parameter', async () => {
    const { navigation } = renderShell('/squads?language=en&create=1')

    expect(await screen.findByText('Create a Squad')).toBeInTheDocument()
    await waitFor(() => expect(navigation.history.location.search).toBe('?language=en'))
  })

  it('gives a visitor the sign-in prompt, which returns to the same URL', async () => {
    const { user, navigation } = renderShell('/squads?create=1', { user: null })

    expect(await screen.findByText('Sign in required')).toBeInTheDocument()
    expect(screen.queryByText('Create a Squad')).not.toBeInTheDocument()
    expect(navigation.history.location.search).toBe('?create=1')
    await user.click(screen.getByRole('button', { name: 'Continue with Discord' }))

    expect(authStore.signInSocialCalls).toEqual([
      { provider: 'discord', callbackURL: `${window.location.origin}/squads?create=1` },
    ])
  })
})

describe('?join=', () => {
  it('opens the sign-in prompt for a visitor, which returns to the invite link', async () => {
    const { user } = renderShell('/squads?join=ABC123', { user: null })

    expect(await screen.findByText('Sign in required')).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue with Discord' }))

    expect(authStore.signInSocialCalls).toEqual([
      { provider: 'discord', callbackURL: `${window.location.origin}/squads?join=ABC123` },
    ])
    expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(0)
  })

  it('stays closed once the visitor closes the prompt', async () => {
    const { user } = renderShell('/squads?join=ABC123', { user: null })
    await screen.findByText('Sign in required')

    await user.click(screen.getByRole('button', { name: 'Maybe later' }))

    await waitFor(() => expect(screen.queryByText('Sign in required')).not.toBeInTheDocument())
  })

  it('joins the squad for a signed-in viewer, with no prompt', async () => {
    renderShell('/squads?join=ABC123')

    await waitFor(() => expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(1))
    expect(screen.queryByText('Sign in required')).not.toBeInTheDocument()
  })
})

describe('the code form', () => {
  it('sends a valid code, in any case, to the board invite link', async () => {
    const { user, navigation } = renderShell('/')

    await user.type(sidebar().getByLabelText('Join by code'), 'abc123')
    await user.click(sidebar().getByRole('button', { name: 'Join the squad with this code' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads?join=ABC123' }])
  })

  it('accepts the code as it is shown, with its #', async () => {
    const { user, navigation } = renderShell('/')

    await user.type(sidebar().getByLabelText('Join by code'), '#vlr77a{Enter}')

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads?join=VLR77A' }])
  })

  it.each(['abc', 'abc1234', 'abc-12', ''])(
    'shows a message and makes no request for the code "%s"',
    async (code) => {
      const { user, navigation } = renderShell('/')
      await sidebar().findByText('3')
      const requestsBefore = countHttpCalls('GET', '/api/rooms')
      const input = sidebar().getByLabelText('Join by code')

      if (code) await user.type(input, code)
      await user.click(sidebar().getByRole('button', { name: 'Join the squad with this code' }))

      expect(sidebar().getByRole('alert')).toHaveTextContent(
        'A squad code has 6 letters or digits.'
      )
      expect(navigation.calls).toEqual([])
      expect(countHttpCalls('GET', '/api/rooms')).toBe(requestsBefore)
      expect(countHttpCalls('POST', '/api/rooms/:code/join')).toBe(0)
    }
  )

  it('takes the message away once the viewer edits the code', async () => {
    const { user } = renderShell('/')
    await user.type(sidebar().getByLabelText('Join by code'), 'abc{Enter}')
    expect(sidebar().getByRole('alert')).toBeInTheDocument()

    await user.type(sidebar().getByLabelText('Join by code'), '1')

    expect(sidebar().queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('the language switch', () => {
  it('writes the cookie and refreshes the route from the sidebar', async () => {
    const { user, navigation } = renderShell('/')

    await user.click(sidebar().getByRole('button', { name: 'PT' }))

    expect(document.cookie).toContain(`${LOCALE_COOKIE}=pt-BR`)
    expect(navigation.calls).toEqual([{ method: 'refresh' }])
  })
})

describe('the drawer', () => {
  /** The menu button of the top bar: the only way to the sidebar below 1024px. */
  function menuButton(): HTMLElement {
    return within(screen.getByRole('banner')).getByRole('button', { name: 'Open menu' })
  }

  it('opens from the menu button with the sidebar in it, and closes with Escape', async () => {
    const { user } = renderShell('/')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(menuButton())

    const drawer = within(await screen.findByRole('dialog', { name: 'Menu' }))
    expect(drawer.getByRole('button', { name: 'Create squad' })).toBeInTheDocument()
    expect(drawer.getByLabelText('Join by code')).toBeInTheDocument()
    expect(drawer.getByRole('link', { name: /^All squads/ })).toBeInTheDocument()
    expect(drawer.getByRole('button', { name: 'Caio' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('returns focus to the menu button when it closes', async () => {
    const { user } = renderShell('/')
    const button = menuButton()

    await user.click(button)
    await screen.findByRole('dialog', { name: 'Menu' })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(button).toHaveFocus())
  })

  it('traps focus: Tab never leaves the drawer', async () => {
    const { user } = renderShell('/')
    await user.click(menuButton())
    const dialog = await screen.findByRole('dialog', { name: 'Menu' })
    const outside = within(screen.getByRole('banner', { hidden: true })).getByRole('link', {
      name: 'Squadzr — home',
      hidden: true,
    })

    // Tab and Shift+Tab past either end of the drawer: Base UI's focus guards send focus back in.
    for (const shift of [false, true]) {
      for (let press = 0; press < 25; press += 1) {
        await user.tab({ shift })
        expect(outside).not.toHaveFocus()
        await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
      }
    }
  })

  it('closes on navigation', async () => {
    const { user, navigation } = renderShell('/')
    await user.click(menuButton())

    await user.click(
      within(await screen.findByRole('dialog', { name: 'Menu' })).getByRole('link', {
        name: /^All squads/,
      })
    )

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads' }])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes when the page changes under it', async () => {
    const { user, navigation } = renderShell('/squads')
    await user.click(menuButton())
    await screen.findByRole('dialog', { name: 'Menu' })

    act(() => navigation.history.push('/'))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes when the viewport grows to the widths that have the sidebar column', async () => {
    const wide = mockMediaQuery(WIDE_QUERY, false)
    const { user } = renderShell('/')
    await user.click(menuButton())
    await screen.findByRole('dialog', { name: 'Menu' })

    act(() => wide.set(true))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes itself before it opens the create dialog', async () => {
    const { user } = renderShell('/')
    await user.click(menuButton())

    await user.click(
      within(await screen.findByRole('dialog', { name: 'Menu' })).getByRole('button', {
        name: 'Create squad',
      })
    )

    expect(await screen.findByText('Create a Squad')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()
  })
})

describe('the bell', () => {
  beforeEach(() => {
    onHttp('GET', '/api/notifications', () => httpOk({ notifications: [squadReadyNotification] }))
  })

  /** Every bell on screen: its only text is the unread count. */
  function bells(): HTMLElement[] {
    return screen.queryAllByRole('button', { name: '1' })
  }

  it('is only in the top bar below 1024px', async () => {
    mockMediaQuery(WIDE_QUERY, false)
    renderShell('/squads')

    await screen.findByRole('button', { name: '1' })

    expect(bells()).toHaveLength(1)
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: '1' })
    ).toBeInTheDocument()
  })

  it('is in the title row of the board at 1024px and up, and not in the top bar', async () => {
    mockMediaQuery(WIDE_QUERY, true)
    renderShell('/squads')

    const bell = await screen.findByRole('button', { name: '1' })

    expect(bells()).toHaveLength(1)
    expect(screen.getByRole('banner')).not.toContainElement(bell)
    expect(bell.closest('main')).not.toBeNull()
    expect(
      within(bell.closest('main') as HTMLElement).getByRole('heading', { level: 1 })
    ).toBeVisible()
  })

  it('is in the Lobby header at 1024px and up, once', async () => {
    mockMediaQuery(WIDE_QUERY, true)
    const { navigation } = renderShell('/')
    expect(navigation).toBeDefined()
    act(() => navigation.history.push(`/squads/${lobbySquad.code}`))

    await screen.findByRole('button', { name: '1' })

    expect(bells()).toHaveLength(1)
  })

  it('is not shown to a visitor', async () => {
    renderShell('/squads', { user: null })
    await screen.findByText('Ranked grind')

    expect(bells()).toHaveLength(0)
  })

  it('moves from the top bar to the page when the viewport grows', async () => {
    const wide = mockMediaQuery(WIDE_QUERY, false)
    renderShell('/squads')
    await screen.findByRole('button', { name: '1' })

    act(() => wide.set(true))

    await waitFor(() =>
      expect(screen.getByRole('banner')).not.toContainElement(bells()[0] as HTMLElement)
    )
    expect(bells()).toHaveLength(1)
  })
})

describe('warm cache', () => {
  it('navigates board → Lobby → board → Lobby with no skeleton', async () => {
    const queryClient = createTestQueryClient()
    // What the layout's and the pages' server reads have already dehydrated on a warm navigation.
    queryClient.setQueryData(['squads'], boardSquads)
    queryClient.setQueryData(squadQueryKey(lobbySquad.code), lobbySquadResponse)
    const { navigation } = renderShell('/squads', { queryClient })
    const noSkeleton = () => {
      expect(screen.queryByTestId('squad-board-skeleton')).not.toBeInTheDocument()
      expect(screen.queryByTestId('lobby-skeleton')).not.toBeInTheDocument()
    }

    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    noSkeleton()

    act(() => navigation.history.push(`/squads/${lobbySquad.code}`))
    noSkeleton()
    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    noSkeleton()

    act(() => navigation.history.push('/squads'))
    noSkeleton()
    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    noSkeleton()

    act(() => navigation.history.push(`/squads/${lobbySquad.code}`))
    noSkeleton()
    expect(await screen.findByText(lobbySquad.name)).toBeInTheDocument()
    noSkeleton()
  })
})
