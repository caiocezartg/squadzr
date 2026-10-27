/**
 * The Squad Board on the App Router (CCC-79, round 2).
 *
 * These tests render the route's own server component, `app/(app)/squads/page.tsx`, inside the providers the
 * root layout gives it, with no TanStack router and no app shell. The flow harness renders the board
 * without checking that a dialog is visible, and it never mounts the App Router page, so it cannot show
 * a dialog that the App Router renders without its animation features.
 */

import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SquadsPage from '@/app/(app)/squads/page'
import { CreateSquadLauncher } from '@/components/layout/create-squad-launcher'
import { getQueryClient } from '@/lib/query-client'
import { boardSquads, openSquad } from './fixtures'
import { createTestQueryClient } from './harness'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'

// The server gives each request its own query client, which React's cache scopes to one request. The
// suite renders as a server does, so each read of the page gets a client of its own.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isServer: true,
}))

// The viewer's cookies and address come from a request, which the suite does not have.
vi.mock('@/lib/server/viewer', () => ({
  getRequestViewer: async () => ({ cookie: null, forwardedFor: null }),
}))

/** A promise the test settles by hand, for a read the test holds back. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/**
 * Renders the page as Next does: the server component's output, awaited as the server awaits it, inside
 * the providers of the root layout.
 */
async function renderSquadsRoute(queryClient: QueryClient = createTestQueryClient()) {
  const page = await SquadsPage()

  return render(
    <EnglishIntlProvider session={fakeSession()}>
      <QueryClientProvider client={queryClient}>
        <CreateSquadLauncher>{page}</CreateSquadLauncher>
      </QueryClientProvider>
    </EnglishIntlProvider>
  )
}

function registerBoardReads(rooms: () => Promise<MockHttpResponse> | MockHttpResponse): void {
  onHttp('GET', '/api/rooms', rooms)
}

describe('squad board on the App Router', () => {
  it('returns without waiting for the server read', async () => {
    signInAsFakeUser()
    createHarnessNavigation('/squads')
    registerBoardReads(() => deferred<MockHttpResponse>().promise)

    const outcome = await Promise.race([
      SquadsPage().then(() => 'rendered'),
      new Promise((resolve) => setTimeout(() => resolve('waiting for the read'), 300)),
    ])

    expect(outcome).toBe('rendered')
  })

  it('shows the title and the filters while a first visit waits for the list, with the skeleton where the list goes', async () => {
    signInAsFakeUser()
    createHarnessNavigation('/squads')
    const squadsRead = deferred<MockHttpResponse>()
    registerBoardReads(() => squadsRead.promise)

    await renderSquadsRoute()

    expect(await screen.findByTestId('squad-board-skeleton')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Explore squads' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search by game or squad name…')).toBeInTheDocument()

    squadsRead.resolve(httpOk(boardSquads))

    expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByTestId('squad-board-skeleton')).not.toBeInTheDocument()
  })

  it('renders the squads the cache holds at once on a client navigation, and then refreshes them', async () => {
    signInAsFakeUser()
    createHarnessNavigation('/squads')
    const queryClient = createTestQueryClient()
    // The cache is older than the read, so the server's state is the newer one.
    queryClient.setQueryData(
      ['squads'],
      { rooms: [openSquad] },
      { updatedAt: Date.now() - 120_000 }
    )
    const squadsRead = deferred<MockHttpResponse>()
    registerBoardReads(() => squadsRead.promise)

    await renderSquadsRoute(queryClient)

    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.queryByTestId('squad-board-skeleton')).not.toBeInTheDocument()

    squadsRead.resolve(httpOk(boardSquads))

    expect(await screen.findByText('Full lobby')).toBeInTheDocument()
  })

  it('opens the create dialog on the App Router page, and the dialog is visible', async () => {
    signInAsFakeUser()
    createHarnessNavigation('/squads')
    registerBoardReads(() => httpOk({ rooms: [] }))

    await renderSquadsRoute()
    const user = userEvent.setup({ delay: null })
    // The empty board offers the create action; the shell's launcher opens the dialog.
    await user.click(await screen.findByRole('button', { name: 'Create Squad' }))

    // The shared dialog fades in with CSS, so it needs no route animation features to show.
    const dialog = await screen.findByRole('dialog', { name: 'Choose the game' }, { timeout: 5000 })
    expect(dialog).toBeVisible()
  })

  it('opens the sign-in prompt for a guest on the App Router page, and the prompt is visible', async () => {
    signOutFakeUser()
    createHarnessNavigation('/squads')
    registerBoardReads(() => httpOk(boardSquads))

    await renderSquadsRoute()
    const user = userEvent.setup({ delay: null })
    await user.click(await screen.findByText('Ranked grind'))

    // The prompt's card animates in like the create dialog's, so it must reach full opacity too.
    const title = await screen.findByText('Sign in required', {}, { timeout: 5000 })
    const card = title.closest('.max-w-xl')
    expect(card).not.toBeNull()
    await waitFor(() => expect(card).toHaveStyle({ opacity: '1' }))
  })

  it('reads the board again in the browser when the server read fails', async () => {
    signInAsFakeUser()
    createHarnessNavigation('/squads')
    let reads = 0
    registerBoardReads(() => {
      reads += 1
      return reads === 1
        ? httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' })
        : httpOk(boardSquads)
    })

    // The app's own client, with its retry policy, reads the board once the server's read has failed.
    await renderSquadsRoute(getQueryClient())

    expect(await screen.findByText('Ranked grind', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms')).toBe(2)
  })

  describe('after a failed read', () => {
    const boardFailure = () => httpError(500, { message: 'boom', error: 'INTERNAL_ERROR' })
    const loadError = 'Failed to load squads. Please refresh the page.'

    it('reads the board again on a revisit once the API is healthy', async () => {
      signInAsFakeUser()
      createHarnessNavigation('/squads')
      const queryClient = createTestQueryClient()
      registerBoardReads(boardFailure)

      const failedVisit = await renderSquadsRoute(queryClient)
      expect(await screen.findByText(loadError)).toBeInTheDocument()
      failedVisit.unmount()

      // The reader went to another page and the API recovered.
      registerBoardReads(() => httpOk(boardSquads))
      await renderSquadsRoute(queryClient)

      expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
      expect(screen.queryByText(loadError)).not.toBeInTheDocument()
    })

    it('reads the board again when the reader tries again, and shows the squad count with it', async () => {
      signInAsFakeUser()
      createHarnessNavigation('/squads')
      registerBoardReads(boardFailure)

      await renderSquadsRoute()
      const user = userEvent.setup({ delay: null })
      await user.click(await screen.findByRole('button', { name: 'Try again' }))
      // The retry reads the failing API again and fails again, which the reader sees as the same error.
      expect(await screen.findByText(loadError)).toBeInTheDocument()

      registerBoardReads(() => httpOk(boardSquads))
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(await screen.findByText('Ranked grind')).toBeInTheDocument()
      expect(screen.getByText('3 open squads')).toBeInTheDocument()
      expect(screen.queryByText(loadError)).not.toBeInTheDocument()
    })
  })
})
