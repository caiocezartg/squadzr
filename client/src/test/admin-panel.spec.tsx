/**
 * The admin panel (#117): its shell (the five sections, the current one, "Back to Squadzr") and the
 * Audit page (newest-first entries with their actor, action, target and reason, the pages held in the
 * URL, the empty and failed reads). The route's gate is covered in lib/server/admin-gate.spec.ts; the
 * panel's look is checked in the browser.
 */

import type { ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { PAGE_SIZE, type AuditEntriesResponse, type AuditEntryDto } from '@squadzr/schemas'
import { AdminShell } from '@/features/admin'
import { AdminAuditPage, AdminOverviewPage } from '@/features/admin/page'
import { createTestQueryClient } from './harness'
import { countHttpCalls, getHttpLog, httpError, httpOk, onHttp } from './http-router'
import { EnglishIntlProvider } from './intl'
import { createHarnessNavigation, settleNavigation } from './navigation'
import { fakeSession, signInAsFakeUser } from './stubs'

const NOW = Date.now()

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString()
}

/** The grant script's entry: no actor, so the panel shows "System". */
const systemGrant: AuditEntryDto = {
  id: 'entry-grant',
  action: 'admin_granted',
  actorId: null,
  actorName: null,
  target: { type: 'user', id: 'user-1', name: 'Caio' },
  reason: null,
  details: { oldRole: 'user', newRole: 'admin' },
  createdAt: minutesAgo(5),
}

/** A closure by an admin whose account is gone since: the id is null, the name stays. */
const closureByFormerAdmin: AuditEntryDto = {
  id: 'entry-closure',
  action: 'squad_closed',
  actorId: null,
  actorName: 'Marina Rocha',
  target: { type: 'squad', id: 'squad-1', name: 'Ranked 5x5', code: 'VLR7K2', game: 'Valorant' },
  reason: 'Offensive squad name.',
  details: null,
  createdAt: minutesAgo(30),
}

const catalogRun: AuditEntryDto = {
  id: 'entry-run',
  action: 'catalog_import_requested',
  actorId: 'user-1',
  actorName: 'Caio',
  target: null,
  reason: null,
  details: { runId: 'run-1' },
  createdAt: minutesAgo(90),
}

function auditPage(
  items: readonly AuditEntryDto[],
  page = 1,
  total = items.length
): AuditEntriesResponse {
  return { items: [...items], page, pageSize: PAGE_SIZE, total }
}

/** `count` role changes, newest first, named after their place in the whole list. */
function roleChanges(count: number, from = 0): AuditEntryDto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `entry-role-${from + index}`,
    action: 'role_changed',
    actorId: 'user-1',
    actorName: 'Caio',
    target: { type: 'user', id: `user-${from + index}`, name: `Player ${from + index}` },
    reason: null,
    details: { oldRole: 'user', newRole: 'admin' },
    createdAt: minutesAgo(from + index + 1),
  }))
}

/** The page the App Router renders at the harness location, inside the admin layout's shell. */
function AdminScene() {
  const pathname = usePathname()
  return pathname === '/admin/audit' ? <AdminAuditPage /> : <AdminOverviewPage />
}

function renderAdmin(url: string, queryClient: QueryClient = createTestQueryClient()) {
  signInAsFakeUser({ role: 'admin' })
  const navigation = createHarnessNavigation(url)
  const tree: ReactNode = (
    <EnglishIntlProvider session={fakeSession()}>
      <QueryClientProvider client={queryClient}>
        <AdminShell>
          <AdminScene />
        </AdminShell>
      </QueryClientProvider>
    </EnglishIntlProvider>
  )
  render(tree)

  return { user: userEvent.setup({ delay: null }), navigation, queryClient }
}

/** The text of `element` outside the parts hidden from assistive technology. */
function spokenText(element: Node): string {
  if (element instanceof HTMLElement && element.getAttribute('aria-hidden') === 'true') return ''
  if (element.nodeType === Node.TEXT_NODE) return element.textContent ?? ''
  return [...element.childNodes].map(spokenText).join('')
}

function sections(): HTMLElement {
  return within(screen.getByRole('complementary', { name: 'Admin menu' })).getByRole('navigation', {
    name: 'Admin sections',
  })
}

/** The rows of the audit table, without its header row. */
async function tableRows(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table', { name: 'Audit entries' })
  return within(table).getAllByRole('row').slice(1)
}

function serveAudit(pages: Record<number, AuditEntriesResponse>): void {
  onHttp('GET', '/api/admin/audit', ({ query }) => {
    const page = Number(query.get('page'))
    const body = pages[page]
    return body ? httpOk(body) : httpOk(auditPage([], page, 0))
  })
}

function auditRequests(): string[] {
  return getHttpLog()
    .filter((request) => request.path === '/api/admin/audit')
    .map((request) => request.query.get('page') ?? '')
}

beforeEach(() => {
  onHttp('GET', '/api/notifications', () => httpOk({ notifications: [] }))
})

describe('admin shell', () => {
  it('lists the five sections in order and marks the current one', () => {
    serveAudit({ 1: auditPage([]) })
    renderAdmin('/admin/audit')

    const links = within(sections()).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Overview',
      'Squads',
      'Users',
      'Catalog',
      'Audit',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/squads',
      '/admin/users',
      '/admin/catalog',
      '/admin/audit',
    ])
    expect(within(sections()).getByRole('link', { name: 'Audit' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(sections()).getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('marks the overview only on its own path, and follows a navigation', async () => {
    serveAudit({ 1: auditPage([systemGrant]) })
    const { user, navigation } = renderAdmin('/admin')
    expect(within(sections()).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page'
    )

    await user.click(within(sections()).getByRole('link', { name: 'Audit' }))
    await settleNavigation()

    expect(navigation.calls).toEqual([{ method: 'push', href: '/admin/audit' }])
    expect(await screen.findByRole('heading', { level: 1, name: 'Audit' })).toBeInTheDocument()
    expect(within(sections()).getByRole('link', { name: 'Audit' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(sections()).getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('leads back to the app and keeps the account at the foot', () => {
    renderAdmin('/admin')
    const sidebar = within(screen.getByRole('complementary', { name: 'Admin menu' }))

    expect(sidebar.getByRole('link', { name: 'Back to Squadzr' })).toHaveAttribute(
      'href',
      '/squads'
    )
    expect(sidebar.getByRole('button', { name: 'Caio' })).toBeInTheDocument()
  })
})

describe('admin audit', () => {
  it('shows each entry with its time, actor, action, target and reason', async () => {
    serveAudit({ 1: auditPage([systemGrant, closureByFormerAdmin, catalogRun]) })
    renderAdmin('/admin/audit')

    const [grant, closure, run] = await tableRows()
    if (!grant || !closure || !run) throw new Error('The audit table has fewer rows than entries')
    // What a screen reader reads in each cell: the avatars' initials and the dash are hidden from it.
    const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map(spokenText)

    expect(cells(grant)).toEqual(['5m ago', 'System', 'Granted adminuser → admin', 'Caio', 'None'])
    expect(cells(closure)).toEqual([
      '30m ago',
      'Marina Rocha',
      'Closed a squad',
      'Ranked 5x5#VLR7K2 · Valorant',
      '“Offensive squad name.”',
    ])
    expect(cells(run)).toEqual([
      '1h ago',
      'Caio',
      'Ran the Catalog ImportManual run',
      'None',
      'None',
    ])
    // The dash stands for the missing values on screen.
    expect(within(grant).getAllByRole('cell')[4]).toHaveTextContent('—')
  })

  it('shows the same entries as a list of rows for phones', async () => {
    serveAudit({ 1: auditPage([systemGrant, closureByFormerAdmin]) })
    renderAdmin('/admin/audit')

    const list = await screen.findByRole('list', { name: 'Audit entries' })
    const [grant, closure] = within(list).getAllByRole('listitem')
    if (!grant || !closure) throw new Error('The audit list has fewer rows than entries')

    expect(within(grant).getByText('Granted admin')).toBeInTheDocument()
    expect(within(grant).getByText('System')).toBeInTheDocument()
    expect(within(closure).getByText('Marina Rocha')).toBeInTheDocument()
    expect(within(closure).getByText('“Offensive squad name.”')).toBeInTheDocument()
  })

  it('renders a page the cache already holds at once, with no loading state or read', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['admin', 'audit', 1], auditPage([systemGrant]))
    renderAdmin('/admin/audit', queryClient)

    expect(screen.getByRole('table', { name: 'Audit entries' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading the audit' })).not.toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/admin/audit')).toBe(0)
  })

  it('moves between pages through the URL', async () => {
    serveAudit({
      1: auditPage(roleChanges(PAGE_SIZE), 1, PAGE_SIZE + 2),
      2: auditPage(roleChanges(2, PAGE_SIZE), 2, PAGE_SIZE + 2),
    })
    const { user, navigation } = renderAdmin('/admin/audit')
    expect(await tableRows()).toHaveLength(PAGE_SIZE)

    await user.click(screen.getByRole('button', { name: 'Page 2' }))

    expect(await screen.findByRole('cell', { name: 'Player 21' })).toBeInTheDocument()
    expect(await tableRows()).toHaveLength(2)
    expect(navigation.history.location.search).toBe('?page=2')
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
    expect(auditRequests()).toEqual(['1', '2'])

    await user.click(screen.getByRole('button', { name: 'Previous page' }))

    expect(await screen.findByRole('cell', { name: 'Player 0' })).toBeInTheDocument()
    expect(navigation.history.location.search).toBe('')
  })

  it('opens the page the URL asks for', async () => {
    serveAudit({
      1: auditPage([systemGrant], 1, PAGE_SIZE + 1),
      2: auditPage([catalogRun], 2, PAGE_SIZE + 1),
    })
    renderAdmin('/admin/audit?page=2')
    expect(await screen.findAllByText('Ran the Catalog Import')).not.toHaveLength(0)
    expect(auditRequests()).toEqual(['2'])
  })

  it('reads an invalid page as the first one, with no pagination for a single page', async () => {
    serveAudit({ 1: auditPage([systemGrant]) })
    renderAdmin('/admin/audit?page=abc')

    expect(await tableRows()).toHaveLength(1)
    expect(auditRequests()).toEqual(['1'])
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('says when nothing has been audited yet', async () => {
    serveAudit({ 1: auditPage([]) })
    renderAdmin('/admin/audit')

    expect(await screen.findByRole('heading', { name: 'No admin actions yet' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('offers the first page for a page past the end', async () => {
    serveAudit({ 1: auditPage([systemGrant], 1, 1), 5: auditPage([], 5, 1) })
    const { user, navigation } = renderAdmin('/admin/audit?page=5')

    await user.click(await screen.findByRole('button', { name: 'Go to the first page' }))

    expect(await tableRows()).toHaveLength(1)
    expect(navigation.history.location.search).toBe('')
  })

  it('shows a failed read with a retry that reads the page again', async () => {
    let fail = true
    onHttp('GET', '/api/admin/audit', () =>
      fail
        ? httpError(500, { error: 'INTERNAL_ERROR', message: 'Boom' })
        : httpOk(auditPage([systemGrant]))
    )
    const { user } = renderAdmin('/admin/audit')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the audit.")
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await tableRows()).toHaveLength(1)
  })
})
