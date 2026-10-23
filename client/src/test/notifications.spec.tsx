/**
 * Notification changes from the header bell (CCC-71). Marking one notification read, marking all
 * read and dismissing one share one mutation helper: a success refetches the list, and a failure
 * shows one error toast while the list keeps its last state.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppHeader } from '@/components/layout/app-header'
import type { UserNotification } from '@/types'
import { createTestQueryClient } from './harness'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import { squadReadyNotification } from './fixtures'
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

/** The header around a page: the bell, the squad pages it opens and the page itself. */
function HeaderScene() {
  const pathname = usePathname()

  return (
    <>
      <AppHeader />
      {pathname.startsWith('/squads/') ? <div>Lobby page</div> : <div>Home page</div>}
    </>
  )
}

function renderHeader(): UserEvent {
  createHarnessNavigation('/')

  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <HeaderScene />
    </QueryClientProvider>
  )

  return userEvent.setup({ delay: null })
}

/** Opens the bell once its unread count shows; the count is the bell's only text. */
async function openNotifications(user: UserEvent, unread: number): Promise<void> {
  await user.click(await screen.findByRole('button', { name: String(unread) }))
}

/** The menu entry of one squad; its dismiss button sits next to it in the same row. */
function squadEntry(squadName: RegExp): HTMLElement {
  return screen.getByRole('button', { name: squadName })
}

let notifications: UserNotification[] = []

beforeEach(() => {
  signInAsFakeUser()
  notifications = [
    squadNotification(ALPHA_ID, 'Alpha squad', 'ALPHA1', null),
    squadNotification(BETA_ID, 'Beta squad', 'BETA22', null),
  ]

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

describe('notification changes from the bell', () => {
  it('marks one notification read, opens its squad and refreshes the list', async () => {
    const user = renderHeader()
    await openNotifications(user, 2)

    await user.click(squadEntry(/Alpha squad/))

    expect(await screen.findByText('Lobby page')).toBeInTheDocument()
    expect(countHttpCalls('POST', `/api/notifications/${ALPHA_ID}/read`)).toBe(1)
    // The refetched list has one unread notification left.
    expect(await screen.findByRole('button', { name: '1' })).toBeInTheDocument()
    expect(toastStore.errorCalls).toEqual([])
  })

  it('marks every notification read in one request', async () => {
    const user = renderHeader()
    await openNotifications(user, 2)

    await user.click(screen.getByRole('button', { name: 'Mark all read' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument()
    )
    expect(countHttpCalls('POST', '/api/notifications/read-all')).toBe(1)
    expect(squadEntry(/Alpha squad/)).toBeInTheDocument()
    expect(squadEntry(/Beta squad/)).toBeInTheDocument()
    expect(toastStore.errorCalls).toEqual([])
  })

  it('deletes a notification when it is dismissed and refreshes the list', async () => {
    const user = renderHeader()
    await openNotifications(user, 2)

    const alphaRow = squadEntry(/Alpha squad/).parentElement as HTMLElement
    await user.click(within(alphaRow).getByRole('button', { name: 'Dismiss' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Alpha squad/ })).not.toBeInTheDocument()
    )
    expect(countHttpCalls('DELETE', `/api/notifications/${ALPHA_ID}`)).toBe(1)
    expect(squadEntry(/Beta squad/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '1' })).toBeInTheDocument()
    expect(toastStore.errorCalls).toEqual([])
  })

  it('shows one error toast and stays on the page when marking one read fails', async () => {
    onHttp('POST', `/api/notifications/${ALPHA_ID}/read`, () =>
      httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' })
    )
    const user = renderHeader()
    await openNotifications(user, 2)

    await user.click(squadEntry(/Alpha squad/))

    await waitFor(() => expect(toastStore.errorCalls).toEqual([INTERNAL_ERROR]))
    expect(screen.getByText('Home page')).toBeInTheDocument()
    expect(screen.queryByText('Lobby page')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '2' })).toBeInTheDocument()
  })

  it('shows one error toast and keeps the notifications unread when marking all read fails', async () => {
    onHttp('POST', '/api/notifications/read-all', () =>
      httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' })
    )
    const user = renderHeader()
    await openNotifications(user, 2)

    await user.click(screen.getByRole('button', { name: 'Mark all read' }))

    await waitFor(() => expect(toastStore.errorCalls).toEqual([INTERNAL_ERROR]))
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '2' })).toBeInTheDocument()
  })

  it('shows one error toast and keeps the notification when dismissing it fails', async () => {
    onHttp('DELETE', `/api/notifications/${ALPHA_ID}`, () =>
      httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' })
    )
    const user = renderHeader()
    await openNotifications(user, 2)

    const alphaRow = squadEntry(/Alpha squad/).parentElement as HTMLElement
    await user.click(within(alphaRow).getByRole('button', { name: 'Dismiss' }))

    await waitFor(() => expect(toastStore.errorCalls).toEqual([INTERNAL_ERROR]))
    expect(squadEntry(/Alpha squad/)).toBeInTheDocument()
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
    const user = renderHeader()
    await openNotifications(user, 2)

    const cover = squadEntry(/Alpha squad/).querySelector('img')
    expect(cover).toHaveAttribute('src', COVER_URL)
    expect(
      within(squadEntry(/Alpha squad/)).getByText(squadReadyNotification.payload.gameName)
    ).toBeInTheDocument()
  })

  it('keeps the look without a cover for notifications written before it existed', async () => {
    const user = renderHeader()
    await openNotifications(user, 2)

    expect(squadEntry(/Beta squad/).querySelector('img')).toBeNull()
    expect(
      within(squadEntry(/Beta squad/)).getByText(squadReadyNotification.payload.gameName)
    ).toBeInTheDocument()
  })
})
