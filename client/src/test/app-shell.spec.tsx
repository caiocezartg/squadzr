/**
 * The app shell in the Next root layout (CCC-76). The header, the footer and the document title sit
 * around the old app, and every shell link reaches the old app's routes and the App Router. The
 * server render shows the viewer's account in the header.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { AnyRoute, Router } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppFooter } from '@/components/layout/app-footer'
import { AppHeader } from '@/components/layout/app-header'
import { DocumentTitle } from '@/components/layout/document-title'
import type { UserNotification } from '@/types'
import { roomReadyNotification } from './fixtures'
import { createTestQueryClient } from './harness'
import { httpOk, onHttp } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import type { HarnessNavigation } from './navigation'
import { RegisterLegacyNavigator } from './shell'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ALPHA_ID = roomReadyNotification.id
const BETA_ID = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b'

let notifications: UserNotification[] = []

function squadNotification(id: string, roomName: string, readAt: string | null): UserNotification {
  return {
    ...roomReadyNotification,
    id,
    readAt,
    payload: { ...roomReadyNotification.payload, roomName },
  }
}

/**
 * The old app's routes, each page naming itself and filling in its title. Without the landing, `/`
 * is an App Router page in the scene and the old app does not own it.
 */
function legacyRouteTree({ landing }: { landing: boolean }): AnyRoute {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const page = (title: string, label: string) =>
    function Page() {
      return (
        <>
          <title>{title}</title>
          <div>{label}</div>
        </>
      )
    }

  const squadsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/',
    component: page('Squads · Squadzr', 'Squads page'),
  })
  const lobbyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/$code',
    component: page('Lobby · Squadzr', 'Lobby page'),
  })
  const mySquadsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/rooms/my',
    component: page('My squads · Squadzr', 'My squads page'),
  })
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: page('Squadzr', 'Home page'),
  })

  const squads = [squadsRoute, lobbyRoute, mySquadsRoute]
  return rootRoute.addChildren(landing ? [homeRoute, ...squads] : squads) as AnyRoute
}

interface ShellScene {
  readonly user: UserEvent
  readonly navigation: HarnessNavigation
  readonly router: Router<AnyRoute>
}

/**
 * The root layout's shell around the old app: the header, the routes, the title and, when the scene
 * has one, the old app's navigator. Without the navigator the shell is on an App Router page.
 */
function renderShell(
  url: string,
  options: { landing?: boolean; registered?: boolean } = {}
): ShellScene {
  const navigation = createHarnessNavigation(url)
  const router = createRouter({
    routeTree: legacyRouteTree({ landing: options.landing ?? true }),
    history: navigation.history,
  })

  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AppHeader />
      <main>
        <RouterProvider router={router} />
      </main>
      <DocumentTitle />
      {options.registered && <RegisterLegacyNavigator router={router} />}
    </QueryClientProvider>
  )

  return { user: userEvent.setup({ delay: null }), navigation, router }
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

describe('shell navigation to the old app', () => {
  it.each([
    ['/', 'Home page'],
    ['/rooms', 'Squads page'],
    ['/rooms/ABC123', 'Lobby page'],
    ['/rooms/my', 'My squads page'],
  ])('reaches every old-app route from the header when the page is %s', async (start, page) => {
    signInAsFakeUser()
    const { user, navigation, router } = renderShell(start, { registered: true })
    expect(await screen.findByText(page)).toBeInTheDocument()

    const destinations: Array<[link: string, path: string, label: string]> = [
      ['ALL SQUADS', '/rooms', 'Squads page'],
      ['MY SQUADS', '/rooms/my', 'My squads page'],
      ['Squadzr logo', '/', 'Home page'],
    ]
    for (const [link, path, label] of destinations) {
      await user.click(headerLink(link))
      await waitFor(() => expect(router.state.location.pathname).toBe(path))
      expect(await screen.findByText(label)).toBeInTheDocument()
    }

    expect(navigation.calls).toEqual([])
  })

  it('reaches the old-app routes from the mobile sidebar', async () => {
    signInAsFakeUser()
    const { user, navigation } = renderShell('/rooms', { registered: true })
    expect(await screen.findByText('Squads page')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(within(sidebarNavigation()).getByRole('link', { name: 'MY SQUADS' }))
    expect(await screen.findByText('My squads page')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(within(sidebarNavigation()).getByRole('link', { name: 'ALL SQUADS' }))
    expect(await screen.findByText('Squads page')).toBeInTheDocument()

    expect(navigation.calls).toEqual([])
  })

  it('opens a squad from its notification through the old-app router', async () => {
    signInAsFakeUser()
    notifications = [squadNotification(ALPHA_ID, 'Alpha squad', null)]
    const { user, navigation } = renderShell('/', { registered: true })

    await user.click(await screen.findByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: /Alpha squad/ }))

    expect(await screen.findByText('Lobby page')).toBeInTheDocument()
    expect(navigation.calls).toEqual([])
  })

  it('hands a path the old app does not own to the Next router', async () => {
    signInAsFakeUser()
    // The landing is an App Router page in this scene, so the old app has no `/` route.
    const { user, navigation } = renderShell('/rooms', { registered: true, landing: false })
    expect(await screen.findByText('Squads page')).toBeInTheDocument()

    await user.click(headerLink('Squadzr logo'))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/' }])
  })

  it('navigates with the Next router from an App Router page, where the old app is not mounted', async () => {
    signInAsFakeUser()
    const navigation = createHarnessNavigation('/')
    const user = userEvent.setup({ delay: null })
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AppHeader />
      </QueryClientProvider>
    )

    await user.click(headerLink('ALL SQUADS'))

    expect(navigation.calls).toEqual([{ method: 'push', href: '/rooms' }])
  })
})

describe('shell document title', () => {
  it('puts the unread count in front of the active route title and follows navigation', async () => {
    signInAsFakeUser()
    notifications = [
      squadNotification(ALPHA_ID, 'Alpha squad', null),
      squadNotification(BETA_ID, 'Beta squad', null),
    ]
    const { user } = renderShell('/rooms', { registered: true })

    await waitFor(() => expect(document.title).toBe('(2) Squads · Squadzr'))

    await user.click(headerLink('MY SQUADS'))
    await waitFor(() => expect(document.title).toBe('(2) My squads · Squadzr'))

    await user.click(await screen.findByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(document.title).toBe('My squads · Squadzr'))
  })
})

describe('shell account', () => {
  it('shows the initial in the account button when the viewer has no avatar', async () => {
    signInAsFakeUser({ name: 'Caio', image: null })
    renderShell('/rooms', { registered: true })

    const account = await screen.findByRole('button', { name: 'Caio' })
    expect(within(account).getByText('C')).toBeInTheDocument()
  })

  it('shows the initial once the avatar image fails to load', async () => {
    signInAsFakeUser({ name: 'Caio', image: 'https://cdn.discordapp.com/avatars/1/broken.png' })
    renderShell('/rooms', { registered: true })

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

    createHarnessNavigation('/rooms')
    expect(renderToStaticMarkup(footer)).toContain('© 2031 Squadzr')

    createHarnessNavigation('/')
    expect(renderToStaticMarkup(footer)).toBe('')
  })
})

describe('shell sources', () => {
  function read(path: string): string {
    return readFileSync(resolve(SRC_DIR, path), 'utf8')
  }

  it('imports no TanStack Router from a shell component', () => {
    const layoutFiles = readdirSync(resolve(SRC_DIR, 'components/layout'))
      .filter((file) => file.endsWith('.tsx') && !/\.spec\./.test(file))
      .map((file) => `components/layout/${file}`)
    const shellFiles = [
      ...layoutFiles,
      'components/ui/user-avatar.tsx',
      'lib/navigation.ts',
      'lib/unread-notifications-store.ts',
      'app/layout.tsx',
    ]

    const importers = shellFiles.filter((file) => read(file).includes('@tanstack/react-router'))

    expect(importers).toEqual([])
  })

  it('imports the notifications menu with the header, with no lazy island or fallback', () => {
    const header = read('components/layout/app-header.tsx')

    expect(header).toContain("from '@/components/layout/notifications-menu'")
    expect(header).not.toMatch(/\blazy\(|next\/dynamic|LazyIslandBoundary|NotificationsFallback/)
  })

  it('leaves the document title to the title component', () => {
    expect(read('components/layout/notifications-menu.tsx')).not.toContain('document.title')
  })
})
