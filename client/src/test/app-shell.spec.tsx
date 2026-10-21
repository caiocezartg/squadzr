/**
 * The app shell in the Next root layout (CCC-76). The header, the footer and the document title sit
 * around the App Router pages, and every shell link navigates through the Next router. The server
 * render shows the viewer's account in the header.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppFooter } from '@/components/layout/app-footer'
import { AppHeader } from '@/components/layout/app-header'
import { DocumentTitle } from '@/components/layout/document-title'
import type { UserNotification } from '@/types'
import { squadReadyNotification } from './fixtures'
import { createTestQueryClient } from './harness'
import { httpOk, onHttp } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import type { HarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'

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

interface ShellScene {
  readonly user: UserEvent
  readonly navigation: HarnessNavigation
}

/** The root layout's header, title and footer around an App Router page. */
function renderShell(url: string): ShellScene {
  const navigation = createHarnessNavigation(url)

  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AppHeader />
      <main />
      <DocumentTitle />
      <AppFooter year={2031} />
    </QueryClientProvider>
  )

  return { user: userEvent.setup({ delay: null }), navigation }
}

/** The header's own links. The mobile sidebar sits outside the header element. */
function headerLink(name: string): HTMLElement {
  return within(screen.getByRole('banner')).getByRole('link', { name })
}

/** The mobile sidebar's navigation: the header comes first in the page, so the sidebar is second. */
function sidebarNavigation(): HTMLElement {
  const navigation = screen.getAllByRole('navigation')[1]
  if (!navigation) throw new Error('The mobile sidebar is not rendered')
  return navigation
}

beforeEach(() => {
  notifications = []
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
  it('sends the header My Squads link to its page', async () => {
    signInAsFakeUser()
    const { user, navigation } = renderShell('/squads')

    await user.click(headerLink('MY SQUADS'))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads/my' }])
  })

  it('sends the mobile sidebar My Squads link to its page', async () => {
    signInAsFakeUser()
    const { user, navigation } = renderShell('/squads')

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(within(sidebarNavigation()).getByRole('link', { name: 'MY SQUADS' }))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads/my' }])
  })

  it('hands a squad notification to the Next router', async () => {
    signInAsFakeUser()
    notifications = [squadNotification(ALPHA_ID, 'Alpha squad', null)]
    const { user, navigation } = renderShell('/squads')

    await user.click(await screen.findByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: /Alpha squad/ }))

    expect(navigation.calls).toEqual([
      { method: 'push', href: `/squads/${squadReadyNotification.payload.roomCode}` },
    ])
  })

  it('sends the logo to the landing', async () => {
    signInAsFakeUser()
    const { user, navigation } = renderShell('/squads')

    await user.click(headerLink('Squadzr logo'))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/' }])
  })

  it('sends the All Squads link from a page the shell does not own to the board', async () => {
    signInAsFakeUser()
    const { user, navigation } = renderShell('/')

    await user.click(headerLink('ALL SQUADS'))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/squads' }])
  })
})

describe('shell document title', () => {
  it('puts the unread count in front of the active route title', async () => {
    signInAsFakeUser()
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
  it('shows the initial in the account button when the viewer has no avatar', async () => {
    signInAsFakeUser({ name: 'Caio', image: null })
    renderShell('/squads')

    const account = await screen.findByRole('button', { name: 'Caio' })
    expect(within(account).getByText('C')).toBeInTheDocument()
  })

  it('shows the initial once the avatar image fails to load', async () => {
    signInAsFakeUser({ name: 'Caio', image: 'https://cdn.discordapp.com/avatars/1/broken.png' })
    renderShell('/squads')

    const account = await screen.findByRole('button', { name: 'Caio' })
    const image = account.querySelector('img')
    if (!image) throw new Error('The avatar image is not rendered')
    fireEvent.error(image)

    expect(within(account).getByText('C')).toBeInTheDocument()
    expect(account.querySelector('img')).toBeNull()
  })
})

describe('shell server render', () => {
  it('shows the signed-in account in the header and never a sign-in button', () => {
    signInAsFakeUser({ name: 'Caio' })

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={createTestQueryClient()}>
        <EnglishIntlProvider session={fakeSession()}>
          <AppHeader />
        </EnglishIntlProvider>
      </QueryClientProvider>
    )

    expect(markup).toContain('Caio')
    expect(markup).not.toContain('Sign In')
  })

  it('shows the sign-in button to a signed-out viewer', () => {
    signOutFakeUser()

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={createTestQueryClient()}>
        <EnglishIntlProvider session={null}>
          <AppHeader />
        </EnglishIntlProvider>
      </QueryClientProvider>
    )

    expect(markup).toContain('Sign In')
  })

  it('renders the footer with the request year, and not on the landing', () => {
    const footer = (
      <EnglishIntlProvider session={null}>
        <AppFooter year={2031} />
      </EnglishIntlProvider>
    )

    createHarnessNavigation('/squads')
    expect(renderToStaticMarkup(footer)).toContain('© 2031 Squadzr')

    createHarnessNavigation('/')
    expect(renderToStaticMarkup(footer)).toBe('')
  })
})
