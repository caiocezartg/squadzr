/**
 * My Squads on the App Router (CCC-81). These tests render the route's own server component,
 * `app/squads/my/page.tsx`, inside the providers the root layout gives it. The request's session
 * decides the redirect, and the route hands the server reads to the browser through the query
 * client without waiting for them.
 */

import type { ReactNode } from 'react'
import { renderToReadableStream } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MySquadsRoute from '@/app/squads/my/page'
import { getRequestSession } from '@/lib/server/session'
import { boardGames, memberSquad, openSquad } from './fixtures'
import { createTestQueryClient } from './harness'
import { countHttpCalls, getHttpLog, httpOk, onHttp } from './http-router'
import type { MockHttpResponse } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation, RedirectError } from './navigation'
import { fakeSession, signInAsFakeUser } from './stubs'

// The server gives each request its own query client, which React's cache scopes to one request. The
// suite renders as a server does, so each read of the page gets a client of its own.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isServer: true,
}))

// The viewer's cookies and address come from a request, which the suite does not have.
vi.mock('@/lib/server/viewer', () => ({
  getRequestViewer: async () => ({
    cookie: 'better-auth.session_token=abc',
    forwardedFor: '203.0.113.7',
  }),
}))

// The root layout reads the session for the request; the page reuses that read.
vi.mock('@/lib/server/session', () => ({
  getRequestSession: vi.fn(),
}))

/** A promise the test settles by hand, for a read the test holds back. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
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
  vi.mocked(getRequestSession).mockResolvedValue(fakeSession())
}

beforeEach(() => {
  vi.mocked(getRequestSession).mockReset()
  onHttp('GET', '/api/games', () => httpOk(boardGames))
})

describe('My Squads on the App Router', () => {
  it('redirects a signed-out viewer to the landing before any content renders', async () => {
    vi.mocked(getRequestSession).mockResolvedValue(null)
    const navigation = createHarnessNavigation('/squads/my')

    await expect(MySquadsRoute()).rejects.toBeInstanceOf(RedirectError)

    expect(navigation.calls).toEqual([{ method: 'redirect', href: '/' }])
    expect(getHttpLog()).toEqual([])
  })

  it('returns without waiting for the server read', async () => {
    signIn()
    createHarnessNavigation('/squads/my')
    const roomsRead = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/my', () => roomsRead.promise)

    const outcome = await Promise.race([
      MySquadsRoute().then(() => 'rendered'),
      new Promise((resolve) => setTimeout(() => resolve('waiting for the read'), 300)),
    ])

    expect(outcome).toBe('rendered')
    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(1)
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
