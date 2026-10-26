/**
 * The app shell (CCC-106). The sidebar and the top bar sit around the app pages, and every shell link
 * navigates through the Next router. The server render shows the sidebar, the squad count and the
 * viewer's account.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppShell } from '@/components/layout/app-shell'
import type { UserNotification } from '@/types'
import { boardSquads, squadReadyNotification } from './fixtures'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'
import type { FakeSessionUser } from './stubs'

const ALPHA_ID = squadReadyNotification.id
const BETA_ID = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b'

let notifications: UserNotification[] = []

function squadNotification(id: string, squadName: string, readAt: string | null): UserNotification {
  return {
    ...squadReadyNotification,
    id,
    readAt,
    payload: { ...squadReadyNotification.payload, roomName: squadName },
  }
}

/** The page at `url` inside the shell; `/` is a page the shell shows no content for. */
function renderShell(url: string, user?: FakeSessionUser | null) {
  return renderSquadsFlow(url, { shell: true, user })
}

/** The sidebar column: the shell's complementary landmark. The top bar is its banner. */
function sidebar(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Menu' })
}

beforeEach(() => {
  notifications = []
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/notifications', () => httpOk({ notifications }))
  onHttp('POST', '/api/notifications/:id/read', ({ params }) => {
    notifications = notifications.map((n) =>
      n.id === params.id ? { ...n, readAt: n.readAt ?? n.createdAt } : n
    )
    return httpOk({ success: true })
  })
  onHttp('POST', '/api/notifications/read-all', () => {
    notifications = notifications.map((n) => ({ ...n, readAt: n.readAt ?? n.createdAt }))
    return httpOk({ success: true, count: 2 })
  })
})

describe('shell navigation', () => {
  it('sends the sidebar logo to the landing', async () => {
    const { user, navigation } = renderShell('/squads')

    await user.click(within(sidebar()).getByRole('link', { name: 'Squadzr — home' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/' }])
  })

  it('sends the top bar logo to the landing', async () => {
    const { user, navigation } = renderShell('/squads')
    const topBar = within(screen.getByRole('banner'))

    await user.click(topBar.getByRole('link', { name: 'Squadzr — home' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/' }])
  })

  it('sends All squads from a page the shell does not own to the board', async () => {
    const { user, navigation } = renderShell('/')

    await user.click(within(sidebar()).getByRole('link', { name: /^All squads/ }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads' }])
  })

  it('marks All squads as the current page on the board only', async () => {
    const { navigation } = renderShell('/squads')
    const allSquads = within(sidebar()).getByRole('link', { name: /^All squads/ })

    expect(allSquads).toHaveAttribute('aria-current', 'page')
    // The current item takes its edge at once: it carries no transition of its own.
    expect(allSquads.className).not.toMatch(/transition|press/)

    navigation.history.push('/')
    await waitFor(() => expect(allSquads).not.toHaveAttribute('aria-current'))
  })

  it('hands a squad notification to the Next router', async () => {
    notifications = [squadNotification(ALPHA_ID, 'Alpha squad', null)]
    const { user, navigation } = renderShell('/squads')

    await user.click(await screen.findByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: /Alpha squad/ }))

    expect(navigation.calls).toEqual([
      { method: 'push', href: `/squads/${squadReadyNotification.payload.roomCode}` },
    ])
  })
})

describe('shell document title', () => {
  it('puts the unread count in front of the active route title', async () => {
    notifications = [
      squadNotification(ALPHA_ID, 'Alpha squad', null),
      squadNotification(BETA_ID, 'Beta squad', null),
    ]
    // The App Router writes the route title on the server; the test starts from that title.
    document.title = 'Squads · Squadzr'
    const { user } = renderShell('/squads')

    await waitFor(() => expect(document.title).toBe('(2) Squads · Squadzr'))

    await user.click(await screen.findByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(document.title).toBe('Squads · Squadzr'))
  })
})

describe('shell account', () => {
  it('shows the initials in the account button when the viewer has no avatar', async () => {
    renderShell('/squads', {
      id: 'user-1',
      name: 'Caio Cezar',
      email: 'c@squadzr.test',
      image: null,
    })

    const account = await within(sidebar()).findByRole('button', { name: 'Caio Cezar' })
    expect(within(account).getByText('CC')).toBeInTheDocument()
  })

  it('shows the initials once the avatar image fails to load', async () => {
    renderShell('/squads', {
      id: 'user-1',
      name: 'Caio Cezar',
      email: 'c@squadzr.test',
      image: 'https://cdn.discordapp.com/avatars/1/broken.png',
    })

    const account = await within(sidebar()).findByRole('button', { name: 'Caio Cezar' })
    const image = account.querySelector('img')
    if (!image) throw new Error('The avatar image is not rendered')
    fireEvent.error(image)

    expect(within(account).getByText('CC')).toBeInTheDocument()
    expect(account.querySelector('img')).toBeNull()
  })

  it('replaces the account button with Sign in with Discord for a visitor', () => {
    renderShell('/squads', null)

    expect(
      within(sidebar()).getByRole('button', { name: 'Sign in with Discord' })
    ).toBeInTheDocument()
    expect(within(sidebar()).queryByRole('button', { name: 'Caio' })).not.toBeInTheDocument()
  })
})

describe('shell server render', () => {
  function serverHtml(session: ReturnType<typeof fakeSession>): string {
    const queryClient = createTestQueryClient()
    // The (app) layout's read, as the server hands it to the browser.
    queryClient.setQueryData(['squads'], boardSquads)

    return renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <EnglishIntlProvider session={session}>
          <AppShell>
            <p>The page</p>
          </AppShell>
        </EnglishIntlProvider>
      </QueryClientProvider>
    )
  }

  it('shows the sidebar, its squad count and the account to a signed-in viewer', () => {
    signInAsFakeUser({ name: 'Caio' })
    createHarnessNavigation('/squads')

    const html = serverHtml(fakeSession())

    expect(html).toContain('Create squad')
    expect(html).toContain('Join by code')
    expect(html).toMatch(new RegExp(`All squads<span[^>]*>${boardSquads.rooms.length}</span>`))
    expect(html).toContain('Caio')
    expect(html).toContain('The page')
    expect(html).not.toContain('Sign in with Discord')
  })

  it('shows Sign in with Discord to a visitor, with the count', () => {
    signOutFakeUser()
    createHarnessNavigation('/squads')

    const html = serverHtml(null)

    expect(html).toContain('Sign in with Discord')
    expect(html).toMatch(new RegExp(`All squads<span[^>]*>${boardSquads.rooms.length}</span>`))
  })

  it('has no footer', () => {
    signInAsFakeUser()
    createHarnessNavigation('/squads')

    expect(serverHtml(fakeSession())).not.toContain('<footer')
  })
})
