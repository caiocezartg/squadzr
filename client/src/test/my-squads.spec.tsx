/**
 * The sidebar's "My squads" (CCC-107). It lists the Squads `/api/rooms/my` returns, hosted and joined
 * merged into one list: a Squad in both appears once, newest first. Each item carries the cover, the
 * host crown, the name, the slot meter and the count; a Ready Squad takes the Discord treatment. The
 * list reads again on focus and after create, join and leave, and a visitor sees a sign-in call to
 * action instead. The list in the first server HTML is covered by app-layout.spec.
 *
 * HTTP runs through the deterministic adapter (./http-router); the route tree and session come from
 * the shared harness (./harness).
 */

import { act, screen, waitFor, within } from '@testing-library/react'
import { focusManager, type QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { boardSquads, lobbySquadResponse, memberSquad, openSquad } from './fixtures'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import { countHttpCalls, httpOk, onHttp } from './http-router'
import { authStore } from './stubs'
import type { MyRoomsResponse, Squad } from '@/types'

const older: Squad = {
  ...memberSquad,
  id: 'aaaaaaaa-0000-4000-8000-0000000000a1',
  code: 'OLD111',
  name: 'Older squad',
  hostId: 'user-1',
  maxPlayers: 5,
  memberCount: 2,
  createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
}

const newer: Squad = {
  ...memberSquad,
  id: 'aaaaaaaa-0000-4000-8000-0000000000a2',
  code: 'NEW222',
  name: 'Newer squad',
  hostId: 'user-9',
  maxPlayers: 5,
  memberCount: 3,
  createdAt: new Date(Date.now() - 1 * 3_600_000).toISOString(),
}

const oneSlotLeft: Squad = {
  ...newer,
  id: 'aaaaaaaa-0000-4000-8000-0000000000a3',
  code: 'ONE333',
  name: 'One slot left',
  memberCount: 4,
  createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
}

const ready: Squad = {
  ...newer,
  id: 'aaaaaaaa-0000-4000-8000-0000000000a4',
  code: 'RDY444',
  name: 'Ready squad',
  memberCount: 5,
}

function registerMySquads(response: () => MyRoomsResponse): void {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))
  // Registered after the lobby route so the exact segment wins over `:code`.
  onHttp('GET', '/api/rooms/my', () => httpOk(response()))
}

async function sidebar() {
  return within(await screen.findByRole('complementary', { name: 'Menu' }))
}

beforeEach(() => {
  authStore.signInSocialCalls.length = 0
})

afterEach(() => {
  focusManager.setFocused(undefined)
})

describe('sidebar my squads — list', () => {
  it('merges hosted and joined into one list, once per id, newest first', async () => {
    registerMySquads(() => ({ hosted: [older, newer], joined: [newer, oneSlotLeft] }))
    renderSquadsFlow('/squads', { shell: true })
    const menu = await sidebar()

    await menu.findByRole('link', { name: /Newer squad/ })

    const section = menu.getByRole('region', { name: 'My squads' })
    const links = within(section).getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveTextContent('One slot left')
    expect(links[1]).toHaveTextContent('Newer squad')
    expect(links[2]).toHaveTextContent('Older squad')
    expect(section).toHaveTextContent('My squads3')
  })

  it('links each item to its Lobby and marks only the squad being viewed as current', async () => {
    registerMySquads(() => ({ hosted: [older], joined: [newer] }))
    renderSquadsFlow(`/squads/${older.code}`, { shell: true })
    const menu = await sidebar()

    const current = await menu.findByRole('link', { name: /Older squad/ })
    const other = menu.getByRole('link', { name: /Newer squad/ })

    expect(current).toHaveAttribute('href', `/squads/${older.code}`)
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(other).not.toHaveAttribute('aria-current')
  })

  it('shows the host crown only on squads the viewer hosts', async () => {
    registerMySquads(() => ({ hosted: [older], joined: [newer] }))
    renderSquadsFlow('/squads', { shell: true })
    const menu = await sidebar()

    const hosted = await menu.findByRole('link', { name: /Older squad/ })
    const joined = menu.getByRole('link', { name: /Newer squad/ })

    expect(within(hosted).getByRole('img', { name: 'You are the host' })).toBeInTheDocument()
    expect(within(joined).queryByRole('img', { name: 'You are the host' })).not.toBeInTheDocument()
  })

  it('shows the count, amber when one slot is left', async () => {
    registerMySquads(() => ({ hosted: [older], joined: [oneSlotLeft] }))
    renderSquadsFlow('/squads', { shell: true })
    const menu = await sidebar()

    const last = await menu.findByRole('link', { name: /One slot left/ })
    const more = menu.getByRole('link', { name: /Older squad/ })

    expect(within(last).getByText('4/5')).toHaveClass('text-amber')
    expect(within(more).getByText('2/5')).not.toHaveClass('text-amber')
  })

  it('marks a squad whose members fill its slots as Ready, with the Discord badge and count', async () => {
    registerMySquads(() => ({ hosted: [], joined: [ready, oneSlotLeft] }))
    renderSquadsFlow('/squads', { shell: true })
    const menu = await sidebar()

    const readyItem = await menu.findByRole('link', { name: /Ready squad/ })
    const openItem = menu.getByRole('link', { name: /One slot left/ })

    expect(within(readyItem).getByRole('img', { name: 'Invite unlocked' })).toBeInTheDocument()
    expect(within(readyItem).getByText('5/5')).toHaveClass('text-discord-soft')
    expect(within(readyItem).getByText('5/5')).not.toHaveClass('text-amber')
    expect(within(openItem).queryByRole('img', { name: 'Invite unlocked' })).not.toBeInTheDocument()
    // The line meter is the item's decorative span: Discord tone when Ready, mint otherwise.
    expect(readyItem.querySelector('span[aria-hidden="true"].text-discord-soft')).not.toBeNull()
    expect(openItem.querySelector('span[aria-hidden="true"].text-discord-soft')).toBeNull()
    expect(openItem.querySelector('span[aria-hidden="true"].text-mint')).not.toBeNull()
  })

  it('shows a sign-in call to action to a visitor, with no read of the list', async () => {
    registerMySquads(() => ({ hosted: [older], joined: [] }))
    const { user } = renderSquadsFlow('/squads', { shell: true, user: null })
    const menu = await sidebar()

    const section = menu.getByRole('region', { name: 'My squads' })
    expect(within(section).getByText('Sign in to see the squads you host or joined.')).toBeVisible()
    expect(within(section).queryByRole('link')).not.toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Sign in' }))
    expect(authStore.signInSocialCalls[0]).toMatchObject({ provider: 'discord' })
    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(0)
  })
})

describe('sidebar my squads — freshness', () => {
  it('reads the list in the browser when the server left it out of the page', async () => {
    registerMySquads(() => ({ hosted: [older], joined: [] }))
    renderSquadsFlow('/squads', { shell: true })
    const menu = await sidebar()

    expect(await menu.findByRole('link', { name: /Older squad/ })).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(1)
  })

  it('reads the list again when the window regains focus', async () => {
    const lists: MyRoomsResponse = { hosted: [older], joined: [] }
    registerMySquads(() => lists)
    const queryClient: QueryClient = createTestQueryClient()
    renderSquadsFlow('/squads', { shell: true, queryClient })
    const menu = await sidebar()
    await menu.findByRole('link', { name: /Older squad/ })

    lists.joined = [newer]
    // The list is fresh for a minute, so the focus read applies to a list that went stale.
    await act(() => queryClient.invalidateQueries({ queryKey: ['my-squads'], refetchType: 'none' }))
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    expect(await menu.findByRole('link', { name: /Newer squad/ })).toBeInTheDocument()
  })

  it('lists a squad the viewer joins from the board', async () => {
    const lists: MyRoomsResponse = { hosted: [], joined: [] }
    registerMySquads(() => lists)
    onHttp('POST', '/api/rooms/:code/join', () => {
      lists.joined = [{ ...openSquad, isMember: true, memberCount: 2 }]
      return httpOk({
        message: 'Joined squad',
        roomMember: {
          id: 'bbbbbbbb-0000-4000-8000-000000000001',
          roomId: openSquad.id,
          userId: 'user-1',
          joinedAt: new Date().toISOString(),
        },
      })
    })
    const { user } = renderSquadsFlow('/squads', { shell: true })
    const menu = await sidebar()
    await menu.findByText('My squads')
    expect(menu.queryByRole('link', { name: /Ranked grind/ })).not.toBeInTheDocument()

    await user.click(await screen.findByText('Ranked grind'))

    await waitFor(() =>
      expect(menu.getByRole('link', { name: /Ranked grind/ })).toHaveAttribute(
        'href',
        '/squads/ABC123'
      )
    )
  })
})
