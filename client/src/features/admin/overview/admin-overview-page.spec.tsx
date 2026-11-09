/**
 * The admin Overview (#120): the four numbers and the Activity chart following one period held in the
 * URL, the metric tabs, the table view of the chart, the recent audit for the roles that read it, and
 * a cached Overview rendering with no loading state, its lines drawing in only where motion is allowed.
 * The look at each width is checked in the browser.
 */

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_METRICS,
  type ActivityMetric,
  type ActivityResponse,
  type AuditEntryDto,
  type OverviewPeriod,
  type OverviewResponse,
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
      online: { current: 488, previous: 448 },
      open: { current: 261, previous: 272 },
    },
    recentAudit,
  }
}

const dateOf = (period: number, index: number) =>
  new Date(LAST_DAY - (period - 1 - index) * DAY_MS).toISOString().slice(0, 10)

/**
 * A series of `period` days ending 5 November 2026; Completed counts 3 a day, Sign-ups 1. The sampled
 * metrics (peak online, Open Squads) have data only on the last three days (10, 20, 30) and none in the
 * previous period, as before the sampler's first deploy.
 */
function activity(metric: ActivityMetric, period: OverviewPeriod): ActivityResponse {
  const sampled = metric === 'online' || metric === 'open'
  const perDay = metric === 'completed' ? 3 : 1
  return {
    metric,
    period,
    rows: Array.from({ length: period }, (_, index) => ({
      date: dateOf(period, index),
      current: sampled ? (index < period - 3 ? null : 10 * (index - period + 4)) : perDay,
      previous: sampled ? null : perDay - 1,
    })),
  }
}

/** A sampled series of the given days, oldest first, with no data in the previous period. */
function sampledSeries(metric: ActivityMetric, values: (number | null)[]): ActivityResponse {
  const period = values.length as OverviewPeriod
  return {
    metric,
    period,
    rows: values.map((current, index) => ({
      date: dateOf(period, index),
      current,
      previous: null,
    })),
  }
}

function cacheOverview(queryClient: QueryClient): void {
  queryClient.setQueryData(overviewQueryKey(30), overview(30))
  for (const metric of ACTIVITY_METRICS)
    queryClient.setQueryData(activityQueryKey(metric, 30), activity(metric, 30))
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

  it('sets the period figures in bold, in mint when the period brought any', async () => {
    onHttp('GET', '/api/admin/overview', () =>
      httpOk({
        ...overview(30),
        metrics: {
          ...overview(30).metrics,
          completed: { current: 0, previous: 4 },
          signups: { current: 12, previous: 3 },
        },
      })
    )
    onHttp('GET', '/api/admin/activity', ({ query }) =>
      httpOk(activity(query.get('metric') as ActivityMetric, 30))
    )
    renderOverview('/admin')

    await screen.findByText('Online users', { selector: 'dt' })
    const grown = within(tile('Registered users')).getByText('+12', { selector: 'strong' })
    expect(grown).toHaveClass('text-mint')
    const none = within(tile('Completed squads')).getByText('0', { selector: 'strong' })
    expect(none).not.toHaveClass('text-mint')
  })

  it('leaves what a tile compares with to screen readers on a phone, keeping it on the chart', async () => {
    serveOverview()
    renderOverview('/admin')

    await screen.findByText('Last 30 days')
    expect(within(tile('Registered users')).getByText('vs 30 previous days')).toHaveClass(
      'max-sm:sr-only'
    )
    const chartTotal = screen
      .getAllByText('vs 30 previous days')
      .filter((element) => !element.closest('dl'))
    expect(chartTotal).toHaveLength(1)
    expect(chartTotal[0]).not.toHaveClass('max-sm:sr-only')
  })

  it('keeps every tile in a row one height, a label on two lines lowering the whole row', async () => {
    serveOverview()
    renderOverview('/admin')

    await screen.findByText('Online users', { selector: 'dt' })
    for (const label of ['Online users', 'Registered users', 'Open squads', 'Completed squads']) {
      expect(tile(label)).toHaveClass('row-span-3', 'grid-rows-subgrid')
      expect(tile(label).children).toHaveLength(3)
    }
  })

  it('writes no plus sign before a period that brought nothing', async () => {
    onHttp('GET', '/api/admin/overview', () =>
      httpOk({
        ...overview(30),
        metrics: {
          ...overview(30).metrics,
          completed: { current: 0, previous: 4 },
          signups: { current: 3, previous: 3 },
        },
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

    await user.keyboard('{ArrowLeft}')
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

    const views = screen.getByRole('group', { name: 'View' })
    expect(within(views).getByRole('button', { name: 'Chart' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(within(views).getByRole('button', { name: 'Table' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await user.click(within(views).getByRole('button', { name: 'Table' }))

    const table = screen.getByRole('table', { name: 'Squads completed per day' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(30)
    expect(rows[0]).toHaveTextContent('Nov 5, 2026')
    expect(rows[29]).toHaveTextContent('Oct 7, 2026')
    expect(rows[0]).toHaveTextContent('32+1')
    expect(within(views).getByRole('button', { name: 'Table' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(within(views).getByRole('button', { name: 'Chart' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('switches back to the chart from the keyboard', async () => {
    serveOverview()
    const { user } = renderOverview('/admin?period=30')
    await screen.findByText('Last 30 days')
    const views = screen.getByRole('group', { name: 'View' })

    await user.click(within(views).getByRole('button', { name: 'Table' }))
    expect(screen.queryByRole('group', { name: /Daily chart/ })).not.toBeInTheDocument()
    act(() => within(views).getByRole('button', { name: 'Chart' }).focus())
    await user.keyboard('{Enter}')

    expect(screen.getByRole('group', { name: /Daily chart/ })).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a day with no data as a dash', async () => {
    const series = activity('completed', 7)
    series.rows[6] = { date: '2026-11-05', current: null, previous: null }
    serveOverview()
    onHttp('GET', '/api/admin/activity', () => httpOk(series))
    const { user } = renderOverview('/admin?period=7')
    await screen.findByText('Last 7 days')

    await user.click(screen.getByRole('button', { name: 'Table' }))

    const [, latest] = within(screen.getByRole('table')).getAllByRole('row')
    expect(latest).toHaveTextContent('No data')
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
    cacheOverview(queryClient)

    renderOverview('/admin', queryClient)

    expect(tile('Online users')).toHaveTextContent('312')
    expect(screen.getByText('Last 30 days')).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Loading the overview' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading the chart' })).not.toBeInTheDocument()
  })

  it('draws the lines in only where motion is allowed, without holding the chart back', () => {
    const queryClient = createTestQueryClient()
    cacheOverview(queryClient)

    renderOverview('/admin', queryClient)

    // Both lines are on screen from the first render; the draw-in is a CSS animation over them that
    // `motion-safe:` leaves out under reduced motion, so they are never hidden waiting for it.
    const lines = screen.getByTestId('activity-lines')
    expect(lines.querySelectorAll('path')).toHaveLength(2)
    expect(lines).toHaveClass('motion-safe:animate-line-draw')
    expect(lines.getAttribute('class')).not.toMatch(/(^|\s)animate-line-draw/)
  })

  it('draws the lines in again for a new metric', async () => {
    serveOverview()
    const { user } = renderOverview('/admin?period=7')
    await screen.findByText('Last 7 days')
    const first = screen.getByTestId('activity-lines')

    await user.click(screen.getByRole('tab', { name: 'Sign-ups' }))
    await screen.findByText('7', { selector: 'span' })

    expect(screen.getByTestId('activity-lines')).not.toBe(first)
  })

  it("shows the period's peak under the live numbers, against the previous period", async () => {
    serveOverview()
    renderOverview('/admin')

    await screen.findByText('Online users', { selector: 'dt' })
    expect(tile('Online users')).toHaveTextContent('Connected right now')
    expect(tile('Online users')).toHaveTextContent('Peak in the period: 488')
    expect(tile('Online users')).toHaveTextContent('Up 9%')
    expect(within(tile('Online users')).getByText('488', { selector: 'strong' })).toBeVisible()
    expect(tile('Open squads')).toHaveTextContent('Open right now')
    expect(tile('Open squads')).toHaveTextContent('Peak in the period: 261')
    expect(tile('Open squads')).toHaveTextContent('Down 4%')
    expect(within(tile('Open squads')).getByText('vs 30 previous days')).toHaveClass(
      'max-sm:sr-only'
    )
  })

  it('shows no peak for a period without samples, and no change without an earlier one', async () => {
    onHttp('GET', '/api/admin/overview', () =>
      httpOk({
        ...overview(30),
        metrics: {
          ...overview(30).metrics,
          online: { current: null, previous: null },
          open: { current: 14, previous: null },
        },
      })
    )
    onHttp('GET', '/api/admin/activity', ({ query }) =>
      httpOk(activity(query.get('metric') as ActivityMetric, 30))
    )
    renderOverview('/admin')

    await screen.findByText('Online users', { selector: 'dt' })
    expect(tile('Online users')).toHaveTextContent('Peak in the period: —None')
    expect(tile('Online users')).not.toHaveTextContent('vs 30 previous days')
    expect(tile('Open squads')).toHaveTextContent('Peak in the period: 14')
    expect(tile('Open squads')).toHaveTextContent('No data to compare')
    expect(tile('Open squads')).not.toHaveTextContent('%')
  })

  it('adds the peak online and Open Squads tabs after the counted ones, on the arrow keys', async () => {
    serveOverview()
    const { user } = renderOverview('/admin?period=7')
    await screen.findByText('Last 7 days')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Completed',
      'Sign-ups',
      'Peak online',
      'Open Squads',
    ])

    act(() => screen.getByRole('tab', { name: 'Completed' }).focus())
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Open Squads' })).toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Peak Open Squads per day' })).toBeVisible()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Peak online' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('heading', { name: 'Peak online users per day' })).toBeVisible()
    expect(
      screen.getByText(/Peak history starts with the first deploy of the sampler/)
    ).toBeVisible()
  })

  it('sums up a sampled metric by its peak day, not by adding the days', async () => {
    serveOverview()
    const { user } = renderOverview('/admin?period=7')
    await screen.findByText('Last 7 days')

    await user.click(screen.getByRole('tab', { name: 'Peak online' }))

    // The last three days peak at 10, 20 and 30; the days before have no data.
    expect(await screen.findByText('30 peak')).toBeVisible()
    expect(screen.queryByText('60')).not.toBeInTheDocument()
    expect(screen.getByText('No data to compare')).toBeInTheDocument()
  })

  it('reads a sampled day with no data in the previous period as no data', async () => {
    serveOverview()
    const { user } = renderOverview('/admin?period=7')
    await screen.findByText('Last 7 days')
    await user.click(screen.getByRole('tab', { name: 'Open Squads' }))
    const chart = await screen.findByRole('group', { name: /Daily chart/ })

    act(() => chart.focus())
    const card = within(chart).getByRole('status')
    expect(card).toHaveTextContent('Current30')
    expect(card).toHaveTextContent('Previous periodNo data')

    await user.click(screen.getByRole('button', { name: 'Table' }))
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('30No data')
    expect(rows[6]).toHaveTextContent('No dataNo data')
  })

  it('draws a day with no data as a gap in the line and a lone day as a dot', async () => {
    serveOverview()
    onHttp('GET', '/api/admin/activity', ({ query }) =>
      httpOk(sampledSeries(query.get('metric') as ActivityMetric, [5, null, 7, 8, null, null, 2]))
    )
    renderOverview('/admin?period=7')
    await screen.findByText('Last 7 days')

    const lines = screen.getByTestId('activity-lines')
    const paths = [...lines.querySelectorAll('path')].map((path) => path.getAttribute('d') ?? '')
    // The previous period has no data: the current line's two-day run, and its two lone days.
    expect(paths).toHaveLength(2)
    expect(paths[0]?.match(/M/g)).toHaveLength(1)
    expect(paths[0]?.match(/L/g)).toHaveLength(1)
    expect(screen.getByTestId('activity-dots').getAttribute('d')?.match(/h0/g)).toHaveLength(2)
    expect(screen.queryByText('No data in this period yet.')).not.toBeInTheDocument()
  })

  it('says so over an empty grid when no day of either period has data', async () => {
    serveOverview()
    onHttp('GET', '/api/admin/activity', ({ query }) =>
      httpOk(sampledSeries(query.get('metric') as ActivityMetric, Array(7).fill(null)))
    )
    renderOverview('/admin?period=7')

    expect(await screen.findByText('No data in this period yet.')).toBeVisible()
    expect(screen.getByTestId('activity-lines').querySelectorAll('path')).toHaveLength(0)
    expect(screen.getByRole('group', { name: /Daily chart/ })).toBeVisible()
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
