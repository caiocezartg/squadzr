/**
 * The notifications panel opened from the bell (CCC-71, CCC-106, CCC-108). Marking one notification
 * read, marking all read and dismissing one share one mutation helper: a success refetches the list,
 * and a failure shows one error toast while the list keeps its last state. The panel is a popover,
 * and a bottom sheet below 640px.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/components/layout/app-shell'
import { NARROW_QUERY } from '@/components/ds/use-media-query'
import type { UserNotification } from '@/types'
import { createTestQueryClient } from './harness'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import { squadReadyNotification } from './fixtures'
import { mockMediaQuery } from './media-query'
import { createHarnessNavigation } from './navigation'
import { signInAsFakeUser, toastStore } from './stubs'

const ALPHA_ID = squadReadyNotification.id
const BETA_ID = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const INTERNAL_ERROR = 'Something went wrong. Please try again later.'

function squadNotification(
  id: string,
  squadName: string,
  roomCode: string,
  readAt: string | null
): UserNotification {
  return {
    ...squadReadyNotification,
    id,
    readAt,
    payload: { ...squadReadyNotification.payload, roomName: squadName, roomCode },
  }
}

/** The shell around a page: the bell in its top bar, the squad pages it opens and the page itself. */
function ShellScene() {
  const pathname = usePathname()

  return (
    <AppShell>
      {pathname.startsWith('/squads/') ? <div>Lobby page</div> : <div>Home page</div>}
    </AppShell>
  )
}

function renderShell(): UserEvent {
  createHarnessNavigation('/')

  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ShellScene />
    </QueryClientProvider>
  )

  return userEvent.setup({ delay: null })
}

/** Opens the bell once its unread count shows; the count is part of the bell's accessible name. */
async function openNotifications(user: UserEvent, unread: number): Promise<void> {
  await user.click(await screen.findByRole('button', { name: `Notifications, ${unread} unread` }))
}

/** The row link of one squad; its dismiss button sits next to it in the same list item. */
function squadEntry(squadName: RegExp): HTMLElement {
  return screen.getByRole('link', { name: squadName })
}

function dismissButton(squadName: string): HTMLElement {
  return screen.getByRole('button', { name: `Dismiss notification for ${squadName}` })
}

const MARK_ALL = { name: 'Mark all as read' }

let notifications: UserNotification[] = []

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  signInAsFakeUser()
  notifications = [
    squadNotification(ALPHA_ID, 'Alpha squad', 'ALPHA1', null),
    squadNotification(BETA_ID, 'Beta squad', 'BETA22', null),
  ]

  onHttp('GET', '/api/rooms', () => httpOk({ rooms: [] }))
  onHttp('GET', '/api/notifications', () => httpOk({ notifications }))
  onHttp('POST', '/api/notifications/read-all', () => {
    notifications = notifications.map((n) => ({ ...n, readAt: n.readAt ?? n.createdAt }))
    return httpOk({ success: true, count: 2 })
  })
  onHttp('POST', '/api/notifications/:id/read', ({ params }) => {
    notifications = notifications.map((n) =>
      n.id === params.id ? { ...n, readAt: n.readAt ?? n.createdAt } : n
    )
    return httpOk({ success: true })
  })
  onHttp('DELETE', '/api/notifications/:id', ({ params }) => {
    notifications = notifications.filter((n) => n.id !== params.id)
    return httpOk({ success: true })
  })
})

describe('the bell and its panel', () => {
  it('opens a dialog named Notifications with one row per squad', async () => {
    const user = renderShell()
    await openNotifications(user, 2)

    const panel = await screen.findByRole('dialog', { name: 'Notifications' })
    expect(within(panel).getAllByText('Discord invite unlocked')).toHaveLength(2)
    expect(within(panel).getAllByText('Unread')).toHaveLength(2)
    expect(squadEntry(/^Alpha squad/)).toBeInTheDocument()
    expect(squadEntry(/^Beta squad/)).toBeInTheDocument()
  })

  it('marks unread rows only', async () => {
    notifications = [
      squadNotification(ALPHA_ID, 'Alpha squad', 'ALPHA1', null),
      squadNotification(BETA_ID, 'Beta squad', 'BETA22', '2026-01-01T00:00:00.000Z'),
    ]
    const user = renderShell()
    await openNotifications(user, 1)

    expect(await screen.findAllByText('Unread')).toHaveLength(1)
    expect(within(squadEntry(/^Alpha squad/)).getByText('Unread')).toBeVisible()
  })

  it('caps the badge at 9+ while the name keeps the real count', async () => {
    notifications = Array.from({ length: 10 }, (_, index) =>
      squadNotification(
        `3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a${String(index).padStart(2, '0')}`,
        `Squad ${index}`,
        `SQD00${index}`,
        null
      )
    )
    renderShell()

    const bell = await screen.findByRole('button', { name: 'Notifications, 10 unread' })
    expect(bell).toHaveTextContent('9+')
  })

  it('shows the empty state, with mark all as read dimmed', async () => {
    notifications = []
    const user = renderShell()

    await user.click(await screen.findByRole('button', { name: 'Notifications' }))

    expect(await screen.findByText('All caught up')).toBeInTheDocument()
    expect(
      screen.getByText('When one of your Squads fills up, the invite lands here.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', MARK_ALL)).toBeDisabled()
  })

  it('renders as a bottom sheet below 640px and keeps working there', async () => {
    mockMediaQuery(NARROW_QUERY, true)
    const user = renderShell()
    await openNotifications(user, 2)

    const sheet = await screen.findByRole('dialog', { name: 'Notifications' })
    expect(within(sheet).getByRole('button', { name: 'Close' })).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', MARK_ALL))

    await waitFor(() => expect(within(sheet).getByRole('button', MARK_ALL)).toBeDisabled())
    expect(countHttpCalls('POST', '/api/notifications/read-all')).toBe(1)
  })
})

describe('the panel code loaded on idle', () => {
  beforeAll(() => {
    // The browser is idle at once, so the panel's code lands without the one-second fallback. jsdom
    // has no idle callback, so the spies are defined on the window and removed again.
    Object.assign(window, {
      requestIdleCallback: (callback: () => void) => window.setTimeout(callback, 0),
      cancelIdleCallback: (handle: number) => window.clearTimeout(handle),
    })
  })

  // After the last test, so the cleanup of its render can still cancel its idle callback.
  afterAll(() => {
    Reflect.deleteProperty(window, 'requestIdleCallback')
    Reflect.deleteProperty(window, 'cancelIdleCallback')
  })

  /** The bell once the Popover owns it: Base UI marks its trigger with the dialog it opens. */
  async function loadedBell(unread: number): Promise<HTMLElement> {
    const bell = await screen.findByRole('button', { name: `Notifications, ${unread} unread` })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: `Notifications, ${unread} unread` })
      ).toHaveAttribute('aria-haspopup', 'dialog')
    )
    return bell
  }

  it('opens from the popover trigger and closes with Escape', async () => {
    const user = renderShell()
    await loadedBell(2)

    await user.click(screen.getByRole('button', { name: 'Notifications, 2 unread' }))
    expect(await screen.findByRole('dialog', { name: 'Notifications' })).toBeVisible()
    expect(squadEntry(/^Alpha squad/)).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument()
    )
  })

  it('keeps focus on the bell when the panel code replaces it', async () => {
    renderShell()
    const early = await screen.findByRole('button', { name: 'Notifications, 2 unread' })
    act(() => early.focus())

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toHaveAttribute(
        'aria-haspopup',
        'dialog'
      )
    )

    expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toHaveFocus()
  })
})

describe('notification changes from the bell', () => {
  it('marks one notification read, opens its squad and refreshes the list', async () => {
    const user = renderShell()
    await openNotifications(user, 2)

    await user.click(squadEntry(/^Alpha squad/))

    expect(await screen.findByText('Lobby page')).toBeInTheDocument()
    expect(countHttpCalls('POST', `/api/notifications/${ALPHA_ID}/read`)).toBe(1)
    // The refetched list has one unread notification left, and the panel has closed.
    expect(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument()
    expect(toastStore.errorCalls).toEqual([])
  })

  it('marks every notification read in one request', async () => {
    const user = renderShell()
    await openNotifications(user, 2)

    await user.click(screen.getByRole('button', MARK_ALL))

    await waitFor(() => expect(screen.getByRole('button', MARK_ALL)).toBeDisabled())
    expect(countHttpCalls('POST', '/api/notifications/read-all')).toBe(1)
    expect(squadEntry(/^Alpha squad/)).toBeInTheDocument()
    expect(squadEntry(/^Beta squad/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
    expect(toastStore.errorCalls).toEqual([])
  })

  it('deletes a notification when it is dismissed and refreshes the list', async () => {
    const user = renderShell()
    await openNotifications(user, 2)

    await user.click(dismissButton('Alpha squad'))

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /^Alpha squad/ })).not.toBeInTheDocument()
    )
    expect(countHttpCalls('DELETE', `/api/notifications/${ALPHA_ID}`)).toBe(1)
    expect(squadEntry(/^Beta squad/)).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    ).toBeInTheDocument()
    expect(toastStore.errorCalls).toEqual([])
  })

  it('shows one error toast and stays on the page when marking one read fails', async () => {
    onHttp('POST', `/api/notifications/${ALPHA_ID}/read`, () =>
      httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' })
    )
    const user = renderShell()
    await openNotifications(user, 2)

    await user.click(squadEntry(/^Alpha squad/))

    await waitFor(() => expect(toastStore.errorCalls).toEqual([INTERNAL_ERROR]))
    expect(screen.getByText('Home page')).toBeInTheDocument()
    expect(screen.queryByText('Lobby page')).not.toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Notifications, 2 unread' })
    ).toBeInTheDocument()
  })

  it('shows one error toast and keeps the notifications unread when marking all read fails', async () => {
    onHttp('POST', '/api/notifications/read-all', () =>
      httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' })
    )
    const user = renderShell()
    await openNotifications(user, 2)

    await user.click(screen.getByRole('button', MARK_ALL))

    await waitFor(() => expect(toastStore.errorCalls).toEqual([INTERNAL_ERROR]))
    expect(screen.getByRole('button', MARK_ALL)).toBeEnabled()
    expect(
      await screen.findByRole('button', { name: 'Notifications, 2 unread' })
    ).toBeInTheDocument()
  })

  it('shows one error toast and keeps the notification when dismissing it fails', async () => {
    onHttp('DELETE', `/api/notifications/${ALPHA_ID}`, () =>
      httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' })
    )
    const user = renderShell()
    await openNotifications(user, 2)

    await user.click(dismissButton('Alpha squad'))

    await waitFor(() => expect(toastStore.errorCalls).toEqual([INTERNAL_ERROR]))
    expect(squadEntry(/^Alpha squad/)).toBeInTheDocument()
  })
})

describe('game cover in the bell', () => {
  const COVER_URL = 'https://cdn.squadzr.test/covers/lol.jpg'

  it('shows the game cover when the notification carries one', async () => {
    notifications = notifications.map((notification) =>
      notification.id === ALPHA_ID
        ? { ...notification, payload: { ...notification.payload, gameCoverUrl: COVER_URL } }
        : notification
    )
    const user = renderShell()
    await openNotifications(user, 2)

    expect(squadEntry(/^Alpha squad/).querySelector('img')).toHaveAttribute('src', COVER_URL)
    expect(
      within(squadEntry(/^Alpha squad/)).getByText(
        new RegExp(squadReadyNotification.payload.gameName)
      )
    ).toBeInTheDocument()
  })

  it('keeps a neutral placeholder without a cover', async () => {
    const user = renderShell()
    await openNotifications(user, 2)

    expect(squadEntry(/^Beta squad/).querySelector('img')).toBeNull()
    expect(
      within(squadEntry(/^Beta squad/)).getByText(
        new RegExp(squadReadyNotification.payload.gameName)
      )
    ).toBeInTheDocument()
  })
})
