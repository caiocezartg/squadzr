/**
 * The (app) layout (CCC-106, CCC-107). The layout reads the Squad Board's list on the server and waits
 * for it, so the sidebar's count and the board are in the HTML the server sends, for a visitor too,
 * since the board is public. For a viewer with a session cookie it also reads their squads, so the
 * sidebar's "My squads" list is in the first HTML; a visitor's request makes no such read.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/app/(app)/layout'
import { SquadBoardPage } from '@/features/squad-board/page'
import { boardSquads, createdSquad, memberSquad } from './fixtures'
import { createTestQueryClient } from './harness'
import { countHttpCalls, httpError, httpOk, onHttp } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser, signOutFakeUser } from './stubs'

// The server gives each request its own query client, which React's cache scopes to one request.
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

const SESSION_COOKIE = 'NEXT_LOCALE=en; better-auth.session_token=abc'
const COUNT_PATTERN = new RegExp(`All squads<span[^>]*>${boardSquads.rooms.length}</span>`)

/** The HTML the server sends for `page` inside the layout, with the layout's own read and no seeded cache. */
async function layoutHtml(
  page: React.ReactNode,
  session: ReturnType<typeof fakeSession>
): Promise<string> {
  const layout = await AppLayout({ children: page })

  return renderToStaticMarkup(
    <QueryClientProvider client={createTestQueryClient()}>
      <EnglishIntlProvider session={session}>{layout}</EnglishIntlProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  viewer.current = { ...viewer.current, cookie: null }
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [createdSquad], joined: [memberSquad] }))
})

describe('(app) layout server render', () => {
  it('shows the sidebar, its squad count and the account to a signed-in viewer', async () => {
    signInAsFakeUser({ name: 'Caio' })
    viewer.current = { ...viewer.current, cookie: SESSION_COOKIE }
    createHarnessNavigation('/squads')

    const html = await layoutHtml(<p>The page</p>, fakeSession())

    expect(html).toContain('Create squad')
    expect(html).toContain('Join by code')
    expect(html).toMatch(COUNT_PATTERN)
    expect(html).toContain('Caio')
    expect(html).toContain('The page')
    expect(html).not.toContain('Sign in with Discord')
  })

  it('has no footer', async () => {
    signInAsFakeUser()
    viewer.current = { ...viewer.current, cookie: SESSION_COOKIE }
    createHarnessNavigation('/squads')

    expect(await layoutHtml(<p>The page</p>, fakeSession())).not.toContain('<footer')
  })

  it('gives a visitor on the Squad Board the squad count and the board list in the first HTML', async () => {
    signOutFakeUser()
    createHarnessNavigation('/squads')

    const html = await layoutHtml(<SquadBoardPage />, null)

    expect(countHttpCalls('GET', '/api/rooms')).toBe(1)
    expect(html).toContain('Sign in with Discord')
    expect(html).toMatch(COUNT_PATTERN)
    expect(html).toContain(boardSquads.rooms[0]!.name)
    expect(html).not.toContain('data-testid="squad-board-skeleton"')
  })

  it("puts the signed-in viewer's squads in the first HTML, with the layout's own read", async () => {
    signInAsFakeUser()
    viewer.current = { ...viewer.current, cookie: SESSION_COOKIE }
    createHarnessNavigation('/squads')

    const html = await layoutHtml(<p>The page</p>, fakeSession())

    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(1)
    expect(html).toContain('My squads')
    expect(html).toContain(createdSquad.name)
    expect(html).toContain(memberSquad.name)
  })

  it('makes no read of My squads for a visitor, and shows the sign-in call to action', async () => {
    signOutFakeUser()
    createHarnessNavigation('/squads')

    const html = await layoutHtml(<p>The page</p>, null)

    expect(countHttpCalls('GET', '/api/rooms/my')).toBe(0)
    expect(html).toContain('Sign in to see the squads you host or joined.')
  })

  it('leaves the list to the browser when the server read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    onHttp('GET', '/api/rooms/my', () => httpError(500, { error: 'boom' }))
    signInAsFakeUser()
    viewer.current = { ...viewer.current, cookie: SESSION_COOKIE }
    createHarnessNavigation('/squads')

    const html = await layoutHtml(<p>The page</p>, fakeSession())

    expect(html).toContain('The page')
    expect(html).not.toContain(createdSquad.name)
  })
})
