/**
 * The admin Catalog's Games tab (#122): the summary strip, the list with its search, status and sort
 * held in the URL, the empty, no-match, past-the-end and error states, the tabs, and a cached list
 * that renders with no loading state. The look at each width is checked in the browser.
 */

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  PAGE_SIZE,
  type AdminGameDto,
  type AdminGamesResponse,
  type AdminGamesSummaryDto,
} from '@squadzr/schemas'
import { createTestQueryClient } from '@/test/harness'
import { getHttpLog, httpError, httpOk, onHttp } from '@/test/http-router'
import { EnglishIntlProvider } from '@/test/intl'
import { createHarnessNavigation } from '@/test/navigation'
import { AdminGamesPage } from './admin-games-page'
import { adminGamesQueryKey, adminGamesSummaryQueryKey } from './games-query'

const valorant: AdminGameDto = {
  id: '7f1c2a4e-5b6d-4c8e-9f0a-1b2c3d4e5f60',
  name: 'Valorant',
  slug: 'valorant',
  coverThumbUrl: 'https://images.test/valorant-thumb.jpg',
  platforms: ['pc'],
  minPlayers: 2,
  maxPlayers: 5,
  popularity: 9120,
  featuredRank: 1,
  listed: true,
  usage: { openSquads: 12, completedSquads: 340 },
}

const quake: AdminGameDto = {
  ...valorant,
  id: '2a6b9c1d-3e4f-4a5b-8c6d-7e8f9a0b1c2d',
  name: 'Quake Arena',
  slug: 'quake-arena',
  platforms: [],
  popularity: 12,
  featuredRank: null,
  listed: false,
  usage: { openSquads: 0, completedSquads: 3 },
}

const summary: AdminGamesSummaryDto = {
  listed: 1684,
  delisted: 41,
  featured: 8,
  lastImport: {
    runId: 'run-1',
    finishedAt: '2026-11-08T04:03:12.000Z',
    entered: {
      total: 7,
      games: [
        { id: valorant.id, name: 'Valorant' },
        { id: '3b7c0d2e-4f5a-4b6c-9d7e-8f9a0b1c2d3e', name: 'Deadlock' },
      ],
    },
    left: { total: 0, games: [] },
  },
}

function gamesPage(
  items: readonly AdminGameDto[],
  total = items.length,
  page = 1
): AdminGamesResponse {
  return { items: [...items], page, pageSize: PAGE_SIZE, total }
}

function serveGames(items: readonly AdminGameDto[], total = items.length): void {
  onHttp('GET', '/api/admin/catalog/games', ({ query }) =>
    httpOk(gamesPage(items, total, Number(query.get('page') ?? 1)))
  )
  onHttp('GET', '/api/admin/catalog/games/summary', () => httpOk(summary))
}

function listReads(): string[] {
  return getHttpLog()
    .filter((request) => request.path === '/api/admin/catalog/games')
    .map((request) => request.query.toString())
}

function renderGames(url = '/admin/catalog', queryClient: QueryClient = createTestQueryClient()) {
  const navigation = createHarnessNavigation(url)
  render(
    <EnglishIntlProvider>
      <QueryClientProvider client={queryClient}>
        <AdminGamesPage />
      </QueryClientProvider>
    </EnglishIntlProvider>
  )
  return { user: userEvent.setup({ delay: null }), navigation }
}

async function tableRows(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table', { name: 'Games' })
  return within(table).getAllByRole('row').slice(1)
}

describe('admin catalog games list', () => {
  it('lists each game with its fields, linked to its page', async () => {
    serveGames([valorant, quake])
    renderGames()

    const [first, second] = await tableRows()
    expect(within(first as HTMLElement).getByRole('link', { name: 'Valorant' })).toHaveAttribute(
      'href',
      `/admin/catalog/games/${valorant.id}`
    )
    expect(first).toHaveTextContent('PC')
    expect(first).toHaveTextContent('2–5')
    expect(first).toHaveTextContent('9,120')
    expect(first).toHaveTextContent('#1')
    expect(first).toHaveTextContent('Listed')
    expect(first).toHaveTextContent(/12\s*340$/)
    expect(second).toHaveTextContent('Delisted')
    // No platform and no featured rank: a dash for each.
    expect(within(second as HTMLElement).getAllByText('None')).toHaveLength(2)

    const cards = within(screen.getByRole('list', { name: 'Games' })).getAllByRole('link')
    expect(cards).toHaveLength(2)
    expect(cards[1]).toHaveTextContent('Completed 3')
  })

  it('shows the counts by status and what the last import changed', async () => {
    serveGames([valorant])
    renderGames()

    const stats = await screen.findByLabelText('Games by status')
    expect(stats).toHaveTextContent('Listed1,684')
    expect(stats).toHaveTextContent('Delisted41')
    expect(stats).toHaveTextContent('Featured8')
    const lastImport = screen.getByRole('region', { name: 'Last import' })
    expect(within(lastImport).getByRole('link', { name: 'Deadlock' })).toHaveAttribute(
      'href',
      '/admin/catalog/games/3b7c0d2e-4f5a-4b6c-9d7e-8f9a0b1c2d3e'
    )
    expect(lastImport).toHaveTextContent('+5 more')
  })

  it('says so when no import has succeeded yet', async () => {
    serveGames([valorant])
    onHttp('GET', '/api/admin/catalog/games/summary', () =>
      httpOk({ ...summary, lastImport: null })
    )
    renderGames()

    expect(await screen.findByText('No import has succeeded yet.')).toBeVisible()
  })

  it('marks the Games tab as the current one', async () => {
    serveGames([valorant])
    renderGames()

    const tabs = screen.getByRole('navigation', { name: 'Catalog sections' })
    expect(within(tabs).getByRole('link', { name: 'Games' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    const runs = within(tabs).getByRole('link', { name: 'Import runs' })
    expect(runs).toHaveAttribute('href', '/admin/catalog/runs')
    expect(runs).not.toHaveAttribute('aria-current')
    await tableRows()
  })

  it('writes the status to the URL and reads it from the first page', async () => {
    serveGames([valorant])
    const { user, navigation } = renderGames('/admin/catalog?page=2')

    await user.click(await screen.findByRole('button', { name: 'Status: All' }))
    await user.click(await screen.findByRole('button', { name: 'Delisted' }))

    expect(navigation.history.location.search).toBe('?status=delisted')
    await expect.poll(() => listReads()).toContain('page=1&status=delisted')
  })

  it('writes the sort to the URL, and drops it for the default', async () => {
    serveGames([valorant])
    const { user, navigation } = renderGames()

    await user.click(await screen.findByRole('button', { name: 'Sort: Popularity' }))
    await user.click(await screen.findByRole('button', { name: 'Most open Squads' }))
    expect(navigation.history.location.search).toBe('?sort=openSquads')
    await expect.poll(() => listReads()).toContain('page=1&sort=openSquads')

    await user.click(await screen.findByRole('button', { name: 'Sort: Most open Squads' }))
    await user.click(await screen.findByRole('button', { name: 'Popularity' }))
    expect(navigation.history.location.search).toBe('')
  })

  it('searches once typing pauses', async () => {
    serveGames([valorant])
    const { user, navigation } = renderGames('/admin/catalog?sort=name&page=3')

    await user.type(screen.getByRole('searchbox', { name: 'Search games' }), 'valo')

    await expect.poll(() => navigation.history.location.search).toBe('?sort=name&q=valo')
    await expect.poll(() => listReads()).toContain('page=1&q=valo&sort=name')
  })

  it('says so when the catalog holds no game', async () => {
    serveGames([])
    renderGames()

    expect(await screen.findByRole('heading', { name: 'No games yet' })).toBeVisible()
  })

  it('says when nothing matches, and clears the filters', async () => {
    serveGames([])
    const { user, navigation } = renderGames('/admin/catalog?q=zzz&status=featured&sort=name')

    expect(await screen.findByRole('heading', { name: 'No games match' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(navigation.history.location.search).toBe('?sort=name')
  })

  it('offers the first page for a page past the end', async () => {
    onHttp('GET', '/api/admin/catalog/games', ({ query }) =>
      httpOk(query.get('page') === '9' ? gamesPage([], 1, 9) : gamesPage([valorant]))
    )
    onHttp('GET', '/api/admin/catalog/games/summary', () => httpOk(summary))
    const { user, navigation } = renderGames('/admin/catalog?page=9')

    expect(await screen.findByRole('heading', { name: 'No games on this page' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Go to the first page' }))

    expect(navigation.history.location.search).toBe('')
    expect(await tableRows()).toHaveLength(1)
  })

  it('shows a failed read with a retry that reads the list again', async () => {
    let fail = true
    onHttp('GET', '/api/admin/catalog/games', () =>
      fail
        ? httpError(500, { error: 'INTERNAL_ERROR', message: 'Boom' })
        : httpOk(gamesPage([valorant]))
    )
    onHttp('GET', '/api/admin/catalog/games/summary', () => httpOk(summary))
    const { user } = renderGames()

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the games.")
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await tableRows()).toHaveLength(1)
  })

  it('renders a cached list and summary at once, with no loading state', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(
      adminGamesQueryKey({ search: '', status: 'all', sort: 'popularity', page: 1 }),
      gamesPage([valorant])
    )
    queryClient.setQueryData(adminGamesSummaryQueryKey(), summary)

    renderGames('/admin/catalog', queryClient)

    expect(screen.getByRole('table', { name: 'Games' })).toBeInTheDocument()
    expect(screen.getByLabelText('Games by status')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading the games' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('status', { name: 'Loading the catalog summary' })
    ).not.toBeInTheDocument()
  })
})
