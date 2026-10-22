/**
 * My Squads on the App Router (CCC-81). These tests render the route's own server component,
 * `app/squads/my/page.tsx`, inside the providers the root layout gives it. The request's session
 * cookie decides the redirect (no API call), and the route hands the server reads to the browser
 * through the query client without waiting for them.
 */

import type { ReactNode } from 'react'
import { renderToReadableStream } from 'react-dom/server'
import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MySquadsRoute from '@/app/squads/my/page'
import { mySquadsQueryKey } from '@/features/my-squads/my-squads-cache'
import { boardGames, memberSquad, openSquad } from './fixtures'
import { createTestQueryClient } from './harness'
import { countHttpCalls, getHttpLog, httpError, httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation, RedirectError } from './navigation'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'

// The server gives each request its own query client, which React's cache scopes to one request. The
// suite renders as a server does, so each read of the page gets a client of its own.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isServer: true,
}))

// The viewer's cookies and address come from a request, which the suite does not have.
const viewer = vi.hoisted(() => ({
  current: { cookie: null as string | null, forwardedFor: '203.0.113.7' as string | null },
}))
vi.mock('@/lib/server/viewer', () => ({
  getRequestViewer: async () => viewer.current,
}))

/** A promise the test settles by hand, for a read the test holds back. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/** Renders the route as Next does in the browser: the server component's output inside the root providers. */
async function renderRoute(queryClient: QueryClient = createTestQueryClient()) {
  const page = await MySquadsRoute()

  return render(
    <EnglishIntlProvider session={fakeSession()}>
      <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>
    </EnglishIntlProvider>
  )
}

/** Renders the page's element as a server does, waiting for the streamed content to finish. */
async function renderRouteHtml(page: ReactNode): Promise<string> {
  const queryClient = createTestQueryClient()
  const stream = await renderToReadableStream(
    <EnglishIntlProvider session={fakeSession()}>
      <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>
    </EnglishIntlProvider>
  )
  await stream.allReady

  return new Response(stream).text()
}

function signIn(): void {
  signInAsFakeUser()
  viewer.current = { ...viewer.current, cookie: 'NEXT_LOCALE=en; better-auth.session_token=abc' }
}

beforeEach(() => {
  viewer.current = { ...viewer.current, cookie: null }
  onHttp('GET', '/api/games', () => httpOk(boardGames))
})

describe('My Squads on the App Router', () => {
  it('redirects a request with no session cookie to the landing before any content renders, with no API call', async () => {
    viewer.current = { ...viewer.current, cookie: 'NEXT_LOCALE=en' }
    const navigation = createHarnessNavigation('/squads/my')

    await expect(MySquadsRoute()).rejects.toBeInstanceOf(RedirectError)

    expect(navigation.calls).toEqual([{ method: 'redirect', href: '/' }])
    expect(getHttpLog()).toEqual([])
  })

  it('accepts the HTTPS session cookie', async () => {
    createHarnessNavigation('/squads/my')
    viewer.current = { ...viewer.current, cookie: '__Secure-better-auth.session_token=abc' }
    onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [], joined: [] }))

    await expect(MySquadsRoute()).resolves.toBeDefined()
  })

  it('redirects in the browser, with no content, when the dehydrated read says the session is expired', async () => {
    // The cookie is present, so the route does not redirect; the root layout's session read found it
    // expired, and so did the list's.
    signOutFakeUser()
    viewer.current = { ...viewer.current, cookie: 'better-auth.session_token=expired' }
    const navigation = createHarnessNavigation('/squads/my')
    onHttp('GET', '/api/rooms/my', () => httpError(401, { error: 'UNAUTHORIZED', message: 'No' }))

    await renderRoute()

    await waitFor(() => expect(navigation.calls).toContainEqual({ method: 'replace', href: '/' }))
    expect(screen.queryByRole('heading', { name: 'My squads' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('my-squads-skeleton')).not.toBeInTheDocument()
  })

  it('returns without waiting for the server read', async () => {
    signIn()
    createHarnessNavigation('/squads/my')
    const squadsRead = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/my', () => squadsRead.promise)

    const outcome = await Promise.race([
      MySquadsRoute().then(() => 'rendered'),
      new Promise((resolve) => setTimeout(() => resolve('waiting for the read'), 300)),
    ])

    expect(outcome).toBe('rendered')
    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(1)
  })

  it('shows the title and the filters while a first visit waits for the lists, with the skeleton where they go', async () => {
    signIn()
    createHarnessNavigation('/squads/my')
    const squadsRead = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/my', () => squadsRead.promise)

    await renderRoute()

    expect(await screen.findByTestId('my-squads-skeleton')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'My squads' })).toBeInTheDocument()

    squadsRead.resolve(httpOk({ hosted: [memberSquad], joined: [openSquad] }))

    expect(await screen.findByText(memberSquad.name)).toBeInTheDocument()
    expect(screen.queryByTestId('my-squads-skeleton')).not.toBeInTheDocument()
  })

  it('renders the lists the cache holds at once on a client navigation, with no skeleton', async () => {
    signIn()
    createHarnessNavigation('/squads/my')
    const queryClient = createTestQueryClient()
    // The cache is older than the read, so the read is still running when the page renders.
    queryClient.setQueryData(
      mySquadsQueryKey,
      { hosted: [memberSquad], joined: [openSquad] },
      { updatedAt: Date.now() - 120_000 }
    )
    queryClient.setQueryData(['games'], boardGames)
    onHttp('GET', '/api/rooms/my', () => deferred<MockHttpResponse>().promise)

    await renderRoute(queryClient)

    expect(screen.getByText(memberSquad.name)).toBeInTheDocument()
    expect(screen.queryByTestId('my-squads-skeleton')).not.toBeInTheDocument()
  })

  it("lists the viewer's hosted and joined Squads in the server HTML", async () => {
    signIn()
    createHarnessNavigation('/squads/my')
    onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [memberSquad], joined: [openSquad] }))

    const page = await MySquadsRoute()
    const html = await renderRouteHtml(page)

    expect(html).toContain(memberSquad.name)
    expect(html).toContain(openSquad.name)
    expect(html).toContain('Created (1)')
    expect(html).toContain('Joined (1)')
  })
})
