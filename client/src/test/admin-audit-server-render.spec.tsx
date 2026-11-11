/**
 * The Audit route's server render (#117). The route reads the page the URL asks for on the server and
 * waits for it, so a hard load has the entries in its HTML and no loading state; a failed read is left
 * to the browser. The admin gate itself is covered in lib/server/admin-gate.spec.ts.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PAGE_SIZE, type AuditEntryDto } from '@squadzr/schemas'
import AdminAuditRoute from '@/app/admin/audit/page'
import { createTestQueryClient } from './harness'
import { getHttpLog, httpError, httpOk, onHttp } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation } from './navigation'
import { fakeSession, signInAsFakeUser } from './stubs'

// The server gives each request its own query client, which React's cache scopes to one request.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isServer: true,
}))

// The viewer's cookies come from a request, which the suite does not have.
vi.mock('@/lib/server/viewer', () => ({
  getRequestViewer: async () => ({ cookie: 'better-auth.session_token=abc' }),
}))

// The gate lets the admin through; its refusals are its own spec's.
vi.mock('@/lib/server/admin-gate', () => ({
  requireAdminSession: async () => fakeSession(),
  requireFullAdminSession: async () => fakeSession(),
}))

const grant: AuditEntryDto = {
  id: 'entry-grant',
  action: 'admin_granted',
  actorId: null,
  actorName: null,
  target: { type: 'user', id: 'user-1', name: 'Marina Rocha' },
  reason: null,
  details: { oldRole: 'user', newRole: 'admin' },
  createdAt: new Date().toISOString(),
}

async function routeHtml(search: Record<string, string>): Promise<string> {
  const route = await AdminAuditRoute({ searchParams: Promise.resolve(search) })

  return renderToStaticMarkup(
    <QueryClientProvider client={createTestQueryClient()}>
      <EnglishIntlProvider session={fakeSession()}>{route}</EnglishIntlProvider>
    </QueryClientProvider>
  )
}

function requestedPages(): string[] {
  return getHttpLog()
    .filter((request) => request.path === '/api/admin/audit')
    .map((request) => request.query.get('page') ?? '')
}

beforeEach(() => {
  signInAsFakeUser({ role: 'admin' })
})

describe('Audit route server render', () => {
  it('puts the entries of the page the URL asks for in the first HTML, with no loading state', async () => {
    onHttp('GET', '/api/admin/audit', ({ query }) =>
      httpOk({ items: [grant], page: Number(query.get('page')), pageSize: PAGE_SIZE, total: 21 })
    )
    createHarnessNavigation('/admin/audit?page=2')

    const html = await routeHtml({ page: '2' })

    expect(requestedPages()).toEqual(['2'])
    expect(html).toContain('Marina Rocha')
    expect(html).toContain('Granted role')
    expect(html).not.toContain('Loading the audit')
  })

  it('reads the first page for an invalid page', async () => {
    onHttp('GET', '/api/admin/audit', () =>
      httpOk({ items: [grant], page: 1, pageSize: PAGE_SIZE, total: 1 })
    )
    createHarnessNavigation('/admin/audit?page=-3')

    await routeHtml({ page: '-3' })

    expect(requestedPages()).toEqual(['1'])
  })

  it('leaves the page to the browser when the server read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    onHttp('GET', '/api/admin/audit', () => httpError(500, { error: 'boom', message: 'Boom' }))
    createHarnessNavigation('/admin/audit')

    const route = await AdminAuditRoute({ searchParams: Promise.resolve({}) })
    const state = (route.props as { state: { queries: unknown[] } }).state

    expect(state.queries).toEqual([])
  })
})
