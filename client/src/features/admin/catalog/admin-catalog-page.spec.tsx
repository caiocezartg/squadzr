/**
 * The admin Catalog page (#122): the Catalog Import Run history with each run's status, origin,
 * duration and counts, the page held in the URL, and the side panel a row opens with every count and
 * the error, interrupted or not-finished note. The look at each width is checked in the browser.
 */

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  PAGE_SIZE,
  type CatalogImportRunDto,
  type CatalogImportRunsResponse,
} from '@squadzr/schemas'
import { createTestQueryClient } from '@/test/harness'
import { httpError, httpOk, onHttp } from '@/test/http-router'
import { EnglishIntlProvider } from '@/test/intl'
import { createHarnessNavigation } from '@/test/navigation'
import { AdminCatalogPage } from './admin-catalog-page'
import { catalogRunsQueryKey } from './catalog-query'

const succeeded: CatalogImportRunDto = {
  id: 'run-succeeded',
  trigger: 'scheduled',
  requestedBy: null,
  status: 'succeeded',
  requestedAt: '2026-11-08T04:00:00.000Z',
  startedAt: '2026-11-08T04:00:00.000Z',
  finishedAt: '2026-11-08T04:03:12.000Z',
  summary: {
    created: 4,
    updated: 37,
    delisted: 2,
    relisted: 1,
    received: 1702,
    dropped: 5,
    invalid: 3,
  },
  listedGames: 1684,
  errorMessage: null,
}

const failed: CatalogImportRunDto = {
  ...succeeded,
  id: 'run-failed',
  trigger: 'manual',
  requestedBy: { id: 'user-caio', name: 'Caio' },
  status: 'failed',
  requestedAt: '2026-11-07T18:42:00.000Z',
  startedAt: '2026-11-07T18:42:00.000Z',
  finishedAt: '2026-11-07T18:42:14.000Z',
  summary: null,
  listedGames: 1681,
  errorMessage: 'IGDB answered 503 Service Unavailable',
}

const safetyStop: CatalogImportRunDto = {
  ...failed,
  id: 'run-safety-stop',
  trigger: 'scheduled',
  requestedBy: null,
  status: 'safety_stop',
  errorMessage: 'Refused to delist 412 games (limit 50)',
}

const interrupted: CatalogImportRunDto = {
  ...succeeded,
  id: 'run-interrupted',
  status: 'interrupted',
  finishedAt: '2026-11-06T04:10:00.000Z',
  summary: null,
  listedGames: null,
}

const queued: CatalogImportRunDto = {
  ...succeeded,
  id: 'run-queued',
  trigger: 'manual',
  requestedBy: { id: null, name: 'Marina Rocha' },
  status: 'requested',
  startedAt: null,
  finishedAt: null,
  summary: null,
  listedGames: null,
}

const running: CatalogImportRunDto = { ...queued, id: 'run-running', status: 'running' }

function runsPage(
  items: readonly CatalogImportRunDto[],
  total = items.length,
  page = 1
): CatalogImportRunsResponse {
  return { items: [...items], page, pageSize: PAGE_SIZE, total }
}

function serveRuns(items: readonly CatalogImportRunDto[], total = items.length): void {
  onHttp('GET', '/api/admin/catalog-import/runs', ({ query }) =>
    httpOk(runsPage(items, total, Number(query.get('page') ?? 1)))
  )
}

function renderCatalog(url = '/admin/catalog', queryClient: QueryClient = createTestQueryClient()) {
  const navigation = createHarnessNavigation(url)
  render(
    <EnglishIntlProvider>
      <QueryClientProvider client={queryClient}>
        <AdminCatalogPage />
      </QueryClientProvider>
    </EnglishIntlProvider>
  )
  return { user: userEvent.setup({ delay: null }), navigation }
}

/** The run table's body rows, once the history has landed. */
async function tableRows(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table', { name: 'Catalog Import runs' })
  return within(table).getAllByRole('row').slice(1)
}

describe('admin catalog run history', () => {
  it('labels a manual run whose admin is unknown as Manual, never as Scheduled', async () => {
    serveRuns([{ ...failed, id: 'run-unknown-admin', requestedBy: null }])
    renderCatalog()

    const [row] = await tableRows()
    expect(row).toHaveTextContent('Manual')
    expect(row).not.toHaveTextContent('Scheduled')
  })

  it('lists each run with its origin, status, duration and counts', async () => {
    serveRuns([succeeded, failed, interrupted, queued])
    renderCatalog()

    const [first, second, third, fourth] = await tableRows()
    expect(first).toHaveTextContent('Scheduled')
    expect(first).toHaveTextContent('Succeeded')
    expect(first).toHaveTextContent('3 min 12 s')
    expect(first).toHaveTextContent(/4\s*2\s*1\s*1,684$/)
    expect(second).toHaveTextContent('Caio')
    expect(second).toHaveTextContent('Failed')
    expect(second).toHaveTextContent('14 s')
    // No summary: a dash for each change, the Listed Games still read.
    expect(within(second as HTMLElement).getAllByText('None')).toHaveLength(3)
    expect(second).toHaveTextContent('1,681')
    expect(third).toHaveTextContent('Interrupted')
    // The duration is a dash too: an interrupted run's finish is when it was noticed, not when it stopped.
    expect(within(third as HTMLElement).getAllByText('None')).toHaveLength(5)
    expect(fourth).toHaveTextContent('Marina Rocha')
    expect(fourth).toHaveTextContent('Queued')
    // Not finished: no duration either.
    expect(within(fourth as HTMLElement).getAllByText('None')).toHaveLength(5)
  })

  it('lists the same runs as cards for a phone', async () => {
    serveRuns([succeeded, safetyStop, running])
    renderCatalog()

    const list = await screen.findByRole('list', { name: 'Catalog Import runs' })
    const cards = within(list).getAllByRole('button')
    expect(cards).toHaveLength(3)
    expect(cards[0]).toHaveTextContent('Created 4')
    expect(cards[0]).toHaveTextContent('Listed Games 1,684')
    expect(cards[1]).toHaveTextContent('Safety stop')
    expect(cards[1]).not.toHaveTextContent('Created')
    expect(cards[2]).toHaveTextContent('Running')
  })

  it('opens a run with every count and the instants it went through', async () => {
    serveRuns([succeeded])
    const { user } = renderCatalog()
    const [row] = await tableRows()

    await user.click(within(row as HTMLElement).getByRole('button'))

    const panel = await screen.findByRole('dialog', { name: /^Run of / })
    const fact = (label: string) =>
      within(panel).getByText(label, { selector: 'dt' }).nextElementSibling
    expect(fact('Status')).toHaveTextContent('Succeeded')
    expect(fact('Origin')).toHaveTextContent('Scheduled')
    expect(fact('Finished')).not.toHaveTextContent('None')
    expect(fact('Duration')).toHaveTextContent('3 min 12 s')
    expect(fact('Created')).toHaveTextContent('4')
    expect(fact('Updated')).toHaveTextContent('37')
    expect(fact('Delisted')).toHaveTextContent('2')
    expect(fact('Relisted')).toHaveTextContent('1')
    expect(fact('Received')).toHaveTextContent('1,702')
    expect(fact('Dropped (repeated)')).toHaveTextContent('5')
    expect(fact('Invalid')).toHaveTextContent('3')
    expect(fact('Listed Games')).toHaveTextContent('1,684')
    expect(within(panel).queryByRole('heading', { name: 'Error' })).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(row as HTMLElement).getByRole('button')).toHaveFocus()
  })

  it.each([
    [failed, 'IGDB answered 503 Service Unavailable'],
    [safetyStop, 'Refused to delist 412 games (limit 50)'],
  ])('shows the error message of a $status run', async (run, message) => {
    serveRuns([run])
    const { user } = renderCatalog()
    const [row] = await tableRows()

    await user.click(within(row as HTMLElement).getByRole('button'))

    const panel = await screen.findByRole('dialog', { name: /^Run of / })
    const error = within(panel).getByRole('region', { name: 'Error' })
    expect(within(error).getByText(message).tagName).toBe('PRE')
    expect(
      within(panel).getByText('Created', { selector: 'dt' }).nextElementSibling
    ).toHaveTextContent('None')
  })

  it('explains an interrupted run', async () => {
    serveRuns([interrupted])
    const { user } = renderCatalog()
    const [row] = await tableRows()

    await user.click(within(row as HTMLElement).getByRole('button'))

    const panel = await screen.findByRole('dialog', { name: /^Run of / })
    expect(panel).toHaveTextContent('This run stopped answering before it finished')
  })

  it('says a queued run has not finished yet', async () => {
    serveRuns([queued])
    const { user } = renderCatalog()
    const [row] = await tableRows()

    await user.click(within(row as HTMLElement).getByRole('button'))

    const panel = await screen.findByRole('dialog', { name: /^Run of / })
    expect(panel).toHaveTextContent('This run has not finished yet.')
    expect(
      within(panel).getByText('Started', { selector: 'dt' }).nextElementSibling
    ).toHaveTextContent('None')
  })

  it('says so when no run was recorded', async () => {
    serveRuns([])
    renderCatalog()

    expect(await screen.findByRole('heading', { name: 'No runs yet' })).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('reads the page the URL holds and writes the next one to it', async () => {
    serveRuns([succeeded], PAGE_SIZE + 1)
    const { user, navigation } = renderCatalog()
    await tableRows()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(navigation.history.location.search).toBe('?page=2')
  })

  it('shows a failed read with a retry that reads the history again', async () => {
    let fail = true
    onHttp('GET', '/api/admin/catalog-import/runs', () =>
      fail
        ? httpError(500, { error: 'INTERNAL_ERROR', message: 'Boom' })
        : httpOk(runsPage([succeeded]))
    )
    const { user } = renderCatalog()

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the run history.")
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await tableRows()).toHaveLength(1)
  })

  it('renders a cached page at once, with no loading state', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(catalogRunsQueryKey(1), runsPage([succeeded]))

    renderCatalog('/admin/catalog', queryClient)

    expect(screen.getByRole('table', { name: 'Catalog Import runs' })).toBeInTheDocument()
    expect(
      screen.queryByRole('status', { name: 'Loading the run history' })
    ).not.toBeInTheDocument()
  })
})
