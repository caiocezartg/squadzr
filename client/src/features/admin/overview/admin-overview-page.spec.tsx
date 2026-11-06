/**
 * The admin Overview (#120): the four numbers and the Activity chart following one period held in the
 * URL, the metric tabs, the table view of the chart, the recent audit for the roles that read it, and
 * a cached Overview rendering with no loading state. The look at each width is checked in the browser.
 */

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type {
  ActivityMetric,
  ActivityResponse,
  AuditEntryDto,
  OverviewPeriod,
  OverviewResponse,
} from '@squadzr/schemas'
import { createTestQueryClient } from '@/test/harness'
import { httpError, httpOk, onHttp } from '@/test/http-router'
import { EnglishIntlProvider } from '@/test/intl'
import { createHarnessNavigation } from '@/test/navigation'
import { AdminOverviewPage } from './admin-overview-page'
import { activityQueryKey, overviewQueryKey } from './overview-query'

const LAST_DAY = Date.UTC(2026, 10, 5)
const DAY_MS = 86_400_000

const grant: AuditEntryDto = {
  id: 'entry-grant',
  action: 'admin_granted',
  actorId: 'user-caio',
  actorName: 'Caio',
  target: { type: 'user', id: 'user-marina', name: 'Marina Rocha' },
  reason: null,
  details: { oldRole: 'user', newRole: 'admin' },
  createdAt: new Date().toISOString(),
}

/** The Overview of a period; the 7-day one has its own numbers so a test can tell them apart. */
function overview(
  period: OverviewPeriod,
  recentAudit: AuditEntryDto[] | null = [grant]
): OverviewResponse {
  const week = period === 7
  return {
    period,
    live: { onlineUsers: 312, totalUsers: 12418, openSquads: 184, completedSquads: 9731 },
    metrics: {
      completed: week ? { current: 50, previous: 100 } : { current: 2131, previous: 1991 },
      signups: week ? { current: 7, previous: 0 } : { current: 1204, previous: 1020 },
    },
    recentAudit,
  }
}

/** A series of `period` days ending 5 November 2026; Completed counts 3 a day, Sign-ups 1. */
function activity(metric: ActivityMetric, period: OverviewPeriod): ActivityResponse {
  const perDay = metric === 'completed' ? 3 : 1
  return {
    metric,
    period,
    rows: Array.from({ length: period }, (_, index) => ({
      date: new Date(LAST_DAY - (period - 1 - index) * DAY_MS).toISOString().slice(0, 10),
      current: perDay,
      previous: perDay - 1,
    })),
  }
}

function serveOverview(recentAudit: AuditEntryDto[] | null = [grant]): void {
  onHttp('GET', '/api/admin/overview', ({ query }) =>
    httpOk(overview(Number(query.get('period')) as OverviewPeriod, recentAudit))
  )
  onHttp('GET', '/api/admin/activity', ({ query }) =>
    httpOk(
      activity(query.get('metric') as ActivityMetric, Number(query.get('period')) as OverviewPeriod)
    )
  )
}

function renderOverview(url: string, queryClient: QueryClient = createTestQueryClient()) {
  const navigation = createHarnessNavigation(url)
  render(
    <EnglishIntlProvider>
      <QueryClientProvider client={queryClient}>
        <AdminOverviewPage />
      </QueryClientProvider>
    </EnglishIntlProvider>
  )
  return { user: userEvent.setup({ delay: null }), navigation }
}

function tile(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: 'dt' })
  if (!term.parentElement) throw new Error(`No tile for ${label}`)
  return term.parentElement
}

describe('admin overview', () => {
  it('shows the live numbers with what the period brought against the period before', async () => {
    serveOverview()
    renderOverview('/admin')

    await screen.findByText('Online users', { selector: 'dt' })
    expect(tile('Online users')).toHaveTextContent('312')
    expect(tile('Registered users')).toHaveTextContent('12,418')
    expect(tile('Registered users')).toHaveTextContent('+1,204 in the period')
    expect(tile('Registered users')).toHaveTextContent('Up 18%')
    expect(tile('Registered users')).toHaveTextContent('vs 30 previous days')
    expect(tile('Open squads')).toHaveTextContent('184')
    expect(tile('Completed squads')).toHaveTextContent('+2,131 in the period')
  })

  it('writes no plus sign before a period that brought nothing', async () => {
    onHttp('GET', '/api/admin/overview', () =>
      httpOk({
        ...overview(30),
        metrics: { completed: { current: 0, previous: 4 }, signups: { current: 3, previous: 3 } },
      })
    )
    onHttp('GET', '/api/admin/activity', ({ query }) =>
      httpOk(activity(query.get('metric') as ActivityMetric, 30))
    )
    renderOverview('/admin')

    await screen.findByText('Online users', { selector: 'dt' })
    expect(tile('Completed squads')).toHaveTextContent('0 in the period')
    expect(tile('Completed squads')).not.toHaveTextContent('+0')
    expect(tile('Registered users')).toHaveTextContent('+3 in the period')
  })

  it('moves the tiles and the chart to the period picked, and writes it to the URL', async () => {
    serveOverview()
    const { user, navigation } = renderOverview('/admin')
    const period = await screen.findByRole('group', { name: 'Period' })
    expect(within(period).getByRole('button', { name: '30 days' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(await screen.findByText('Last 30 days')).toBeVisible()

    await user.click(within(period).getByRole('button', { name: '7 days' }))

    expect(await screen.findByText('Last 7 days')).toBeVisible()
    expect(navigation.history.location.search).toBe('?period=7')
    expect(within(period).getByRole('button', { name: '7 days' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(tile('Completed squads')).toHaveTextContent('+50 in the period')
    expect(tile('Completed squads')).toHaveTextContent('Down 50%')
    expect(tile('Registered users')).toHaveTextContent('new')
    expect(tile('Registered users')).toHaveTextContent('vs 7 previous days')
    // Seven days of 3 Completed Squads, against seven of 2.
    expect(screen.getByText('21')).toBeVisible()
  })

  it('switches the chart between its metrics with clicks and the arrow keys', async () => {
    serveOverview()
    const { user } = renderOverview('/admin?period=7')
    const completed = await screen.findByRole('tab', { name: 'Completed' })
    expect(completed).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Squads completed per day' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Sign-ups' }))
    expect(screen.getByRole('heading', { name: 'Sign-ups per day' })).toBeVisible()
    expect(await screen.findByText('7', { selector: 'span' })).toBeVisible()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Completed' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Completed' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Completed' })).toBeVisible()
  })

  it('reads a day of the chart from the keyboard', async () => {
    serveOverview()
    const { user } = renderOverview('/admin?period=7')
    const chart = await screen.findByRole('group', { name: /Daily chart/ })

    act(() => chart.focus())
    expect(within(chart).getByRole('status')).toHaveTextContent('Nov 5')
    await user.keyboard('{ArrowLeft}')

    const card = within(chart).getByRole('status')
    expect(card).toHaveTextContent('Nov 4')
    expect(card).toHaveTextContent('Current3')
    expect(card).toHaveTextContent('Previous period2')
    expect(card).toHaveTextContent('Difference+1')
  })

  it('lists every day of the period in the table view', async () => {
    serveOverview()
    const { user } = renderOverview('/admin?period=30')
    await screen.findByText('Last 30 days')

    const toggle = screen.getByRole('button', { name: 'View as table' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)

    const table = screen.getByRole('table', { name: 'Squads completed per day' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(30)
    expect(rows[0]).toHaveTextContent('Nov 5, 2026')
    expect(rows[29]).toHaveTextContent('Oct 7, 2026')
    expect(rows[0]).toHaveTextContent('32+1')
    expect(screen.getByRole('button', { name: 'View as table' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('shows a day with no data as a dash', async () => {
    const series = activity('completed', 7)
    series.rows[6] = { date: '2026-11-05', current: null, previous: null }
    serveOverview()
    onHttp('GET', '/api/admin/activity', () => httpOk(series))
    const { user } = renderOverview('/admin?period=7')
    await screen.findByText('Last 7 days')

    await user.click(screen.getByRole('button', { name: 'View as table' }))

    const [, latest] = within(screen.getByRole('table')).getAllByRole('row')
    expect(latest).toHaveTextContent('None')
  })

  it('lists the latest admin actions, linked to the Audit page', async () => {
    serveOverview()
    renderOverview('/admin')

    const recent = await screen.findByRole('region', { name: 'Recent actions' })
    expect(recent).toHaveTextContent('Granted role')
    expect(recent).toHaveTextContent('Marina Rocha')
    expect(within(recent).getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/admin/audit'
    )
  })

  it('leaves the recent actions out for a moderator', async () => {
    serveOverview(null)
    renderOverview('/admin')

    await screen.findByText('Online users', { selector: 'dt' })
    expect(screen.queryByRole('region', { name: 'Recent actions' })).not.toBeInTheDocument()
  })

  it('renders a cached Overview at once, with no loading state', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(overviewQueryKey(30), overview(30))
    queryClient.setQueryData(activityQueryKey('completed', 30), activity('completed', 30))
    queryClient.setQueryData(activityQueryKey('signups', 30), activity('signups', 30))

    renderOverview('/admin', queryClient)

    expect(tile('Online users')).toHaveTextContent('312')
    expect(screen.getByText('Last 30 days')).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Loading the overview' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading the chart' })).not.toBeInTheDocument()
  })

  it('shows a failed read with a retry that reads the Overview again', async () => {
    let fail = true
    onHttp('GET', '/api/admin/overview', () =>
      fail ? httpError(500, { error: 'INTERNAL_ERROR', message: 'Boom' }) : httpOk(overview(30))
    )
    onHttp('GET', '/api/admin/activity', () => httpOk(activity('completed', 30)))
    const { user } = renderOverview('/admin')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the overview.")
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Online users', { selector: 'dt' })).toBeVisible()
  })
})
