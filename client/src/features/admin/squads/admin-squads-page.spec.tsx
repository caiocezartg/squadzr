/**
 * The admin Squads list (#119): the Open Squads with their filters and page held in the URL, the side
 * panel a row opens (`?squad=`) with the roster and the full Discord invite, and the close dialog with
 * its reason, counter and refusals. The look at each width is checked in the browser.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  PAGE_SIZE,
  type AdminSquadDetailDto,
  type AdminSquadDto,
  type AdminSquadsResponse,
} from '@squadzr/schemas'
import { boardGames, gameCs2, gameLol } from '@/test/fixtures'
import { createTestQueryClient } from '@/test/harness'
import { getHttpLog, httpError, httpOk, onHttp } from '@/test/http-router'
import { EnglishIntlProvider } from '@/test/intl'
import { createHarnessNavigation } from '@/test/navigation'
import { AdminSquadsPage } from './admin-squads-page'
import { adminSquadsQueryKey } from './squads-query'

const RANKED_ID = 'a1b2c3d4-0000-4000-8000-000000000001'
const FLEX_ID = 'a1b2c3d4-0000-4000-8000-000000000002'

const ranked: AdminSquadDto = {
  id: RANKED_ID,
  code: 'VLR7K2',
  name: 'Ranked 5x5 friday',
  game: { id: gameCs2.id, name: gameCs2.name, coverThumbUrl: gameCs2.coverThumbUrl },
  platform: 'pc',
  host: { id: 'user-diego', name: 'Diego Alves' },
  memberCount: 2,
  maxPlayers: 5,
  createdAt: '2026-11-08T10:00:00.000Z',
  lastActivityAt: '2026-11-08T10:10:00.000Z',
}

const flex: AdminSquadDto = {
  ...ranked,
  id: FLEX_ID,
  code: 'LOL4QX',
  name: 'Chill flex',
  game: { id: gameLol.id, name: gameLol.name, coverThumbUrl: gameLol.coverThumbUrl },
  host: { id: 'user-ana', name: 'Ana Lima' },
}

const INVITE = 'https://discord.gg/ranked5x-friday'

const rankedDetail: AdminSquadDetailDto = {
  ...ranked,
  language: 'pt-br',
  discordLink: INVITE,
  members: [
    {
      id: 'user-marina',
      name: 'Marina Rocha',
      image: null,
      isHost: false,
      joinedAt: '2026-11-08T10:05:00.000Z',
    },
    {
      id: 'user-diego',
      name: 'Diego Alves',
      image: null,
      isHost: true,
      joinedAt: '2026-11-08T10:00:00.000Z',
    },
  ],
}

function squadsPage(items: readonly AdminSquadDto[], page = 1): AdminSquadsResponse {
  return { items: [...items], page, pageSize: PAGE_SIZE, total: items.length }
}

/** Answers every list read with the Squads whose name holds the search and that play the Game. */
function serveSquads(squads: readonly AdminSquadDto[]): void {
  onHttp('GET', '/api/admin/squads', ({ query }) => {
    const search = (query.get('q') ?? '').toLowerCase()
    const gameId = query.get('gameId')
    return httpOk(
      squadsPage(
        squads.filter(
          (squad) =>
            squad.name.toLowerCase().includes(search) && (!gameId || squad.game.id === gameId)
        )
      )
    )
  })
}

function serveDetail(): void {
  onHttp('GET', '/api/admin/squads/:id', () => httpOk({ squad: rankedDetail }))
}

function listReads(): string[] {
  return getHttpLog()
    .filter((request) => request.path === '/api/admin/squads')
    .map((request) => request.query.toString())
}

function renderSquads(url: string, queryClient = createTestQueryClient()) {
  const navigation = createHarnessNavigation(url)
  render(
    <EnglishIntlProvider>
      <QueryClientProvider client={queryClient}>
        <AdminSquadsPage />
      </QueryClientProvider>
    </EnglishIntlProvider>
  )
  return { user: userEvent.setup({ delay: null }), navigation }
}

async function openRanked(user: ReturnType<typeof userEvent.setup>) {
  const table = await screen.findByRole('table', { name: 'Open squads' })
  await user.click(within(table).getByRole('button', { name: 'Ranked 5x5 friday' }))
  return screen.findByRole('dialog', { name: 'Ranked 5x5 friday' })
}

describe('admin squads list', () => {
  it('renders a page the cache already holds at once, with no loading state or read', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(
      adminSquadsQueryKey({
        search: '',
        gameId: '',
        platform: '',
        language: '',
        sort: 'newest',
        page: 1,
      }),
      squadsPage([ranked, flex])
    )
    renderSquads('/admin/squads', queryClient)

    expect(screen.getByRole('table', { name: 'Open squads' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading squads' })).not.toBeInTheDocument()
    expect(getHttpLog().filter((request) => request.path === '/api/admin/squads')).toHaveLength(0)
  })

  it('lists each Open Squad with its code, host and slots, and the total', async () => {
    serveSquads([ranked, flex])
    renderSquads('/admin/squads')

    const table = await screen.findByRole('table', { name: 'Open squads' })
    const [, rankedRow] = within(table).getAllByRole('row')
    if (!rankedRow) throw new Error('The squads table has no rows')

    expect(rankedRow).toHaveTextContent('Ranked 5x5 friday')
    expect(rankedRow).toHaveTextContent('Counter-Strike 2 · PC')
    expect(rankedRow).toHaveTextContent('#VLR7K2')
    expect(rankedRow).toHaveTextContent('Diego Alves')
    expect(rankedRow).toHaveTextContent('2 of 5 slots taken')
    expect(screen.getByText('2 forming now')).toBeVisible()

    const phoneList = screen.getByRole('list', { name: 'Open squads' })
    expect(within(phoneList).getAllByRole('button')).toHaveLength(2)
  })

  it('writes the search to the URL on the first page and keeps the Game', async () => {
    serveSquads([ranked, flex])
    const { user, navigation } = renderSquads(`/admin/squads?gameId=${gameLol.id}&page=2`)

    await user.type(screen.getByRole('searchbox', { name: 'Search squads' }), 'chill')

    await expect
      .poll(() => navigation.history.location.search, { timeout: 2000 })
      .toBe(`?gameId=${gameLol.id}&q=chill`)
    await expect
      .poll(() => listReads())
      .toEqual([`page=2&gameId=${gameLol.id}`, `page=1&q=chill&gameId=${gameLol.id}`])
  })

  it('names the Game the URL keeps from the first row, and picks another Game', async () => {
    serveSquads([ranked, flex])
    onHttp('GET', '/api/games', () => httpOk(boardGames))
    const { user, navigation } = renderSquads(`/admin/squads?gameId=${gameLol.id}`)

    const chip = await screen.findByRole('button', { name: 'Game: League of Legends' })
    await user.click(chip)
    await user.click(await screen.findByRole('option', { name: 'Counter-Strike 2' }))

    expect(navigation.history.location.search).toBe(`?gameId=${gameCs2.id}`)
    expect(await screen.findByRole('button', { name: 'Game: Counter-Strike 2' })).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Ranked 5x5 friday' })).toBeVisible()
  })

  it('names the Game the URL keeps even when no Squad matches it', async () => {
    serveSquads([ranked])
    onHttp('GET', '/api/games/:id', () => httpOk({ game: gameLol }))
    renderSquads(`/admin/squads?gameId=${gameLol.id}`)

    expect(
      await screen.findByRole('heading', { name: 'No squads match the filters' })
    ).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Game: League of Legends' })).toBeVisible()
  })

  it('pushes a page change to the URL', async () => {
    const many = Array.from({ length: PAGE_SIZE }, (_, index) => ({
      ...ranked,
      id: `a1b2c3d4-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `Squad ${index}`,
    }))
    onHttp('GET', '/api/admin/squads', ({ query }) =>
      httpOk({ ...squadsPage(many, Number(query.get('page'))), total: PAGE_SIZE * 2 })
    )
    const { user, navigation } = renderSquads('/admin/squads')

    await screen.findByRole('table', { name: 'Open squads' })
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(navigation.history.location.search).toBe('?page=2')
    await expect.poll(() => listReads()).toContain('page=2')
  })

  it('says when nothing matches, and clears the filters', async () => {
    serveSquads([ranked])
    const { user, navigation } = renderSquads('/admin/squads?q=zed')

    expect(
      await screen.findByRole('heading', { name: 'No squads match the filters' })
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByRole('table', { name: 'Open squads' })).toBeVisible()
    expect(navigation.history.location.search).toBe('')
  })

  it('says when no Squad is open', async () => {
    serveSquads([])
    renderSquads('/admin/squads')

    expect(await screen.findByRole('heading', { name: 'No open squads right now' })).toBeVisible()
  })

  it('shows a failed read with a retry that reads the list again', async () => {
    let fail = true
    onHttp('GET', '/api/admin/squads', () =>
      fail
        ? httpError(500, { error: 'INTERNAL_ERROR', message: 'Boom' })
        : httpOk(squadsPage([ranked]))
    )
    const { user } = renderSquads('/admin/squads')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the squads.")
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('table', { name: 'Open squads' })).toBeVisible()
  })
})

describe('admin squads sort and filters', () => {
  it.each([
    ['Oldest', 'oldest'],
    ['Least recent activity', 'stale'],
    ['Most full', 'fullest'],
  ])('sorts by %s from the first page', async (label, sort) => {
    serveSquads([ranked, flex])
    const { user, navigation } = renderSquads('/admin/squads?page=2')

    await user.click(await screen.findByRole('button', { name: 'Sort: Newest' }))
    await user.click(await screen.findByRole('button', { name: label }))

    expect(navigation.history.location.search).toBe(`?sort=${sort}`)
    expect(await screen.findByRole('button', { name: `Sort: ${label}` })).toBeVisible()
    await expect.poll(() => listReads()).toContain(`page=1&sort=${sort}`)
  })

  it('writes no sort to the URL for the default, newest first', async () => {
    serveSquads([ranked, flex])
    const { user, navigation } = renderSquads('/admin/squads?sort=stale&page=2')

    await user.click(await screen.findByRole('button', { name: 'Sort: Least recent activity' }))
    await user.click(await screen.findByRole('button', { name: 'Newest' }))

    expect(navigation.history.location.search).toBe('')
    await expect.poll(() => listReads()).toEqual(['page=2&sort=stale', 'page=1'])
  })

  it('keeps one platform from the first page', async () => {
    serveSquads([ranked, flex])
    const { user, navigation } = renderSquads('/admin/squads?page=2')

    await user.click(await screen.findByRole('button', { name: 'Filters' }))
    await user.click(await screen.findByRole('radio', { name: 'PS5' }))

    expect(navigation.history.location.search).toBe('?platform=ps5')
    expect(screen.getByRole('radio', { name: 'PS5' })).toBeChecked()
    await expect.poll(() => listReads()).toContain('page=1&platform=ps5')
  })

  it('keeps one Squad language from the first page', async () => {
    serveSquads([ranked, flex])
    const { user, navigation } = renderSquads('/admin/squads?page=2')

    await user.click(await screen.findByRole('button', { name: 'Filters' }))
    await user.click(await screen.findByRole('button', { name: 'EN-US' }))

    expect(navigation.history.location.search).toBe('?language=en')
    expect(screen.getByRole('button', { name: 'EN-US' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => listReads()).toContain('page=1&language=en')
  })

  it('shows the sort, platform and language the URL keeps', async () => {
    serveSquads([ranked, flex])
    const { user } = renderSquads('/admin/squads?platform=ps5&language=en&sort=fullest')

    await user.click(await screen.findByRole('button', { name: 'Sort: Most full' }))
    expect(await screen.findByRole('button', { name: 'Most full' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Filters 2 active' }))
    expect(await screen.findByRole('radio', { name: 'PS5' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'EN-US' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => listReads()).toEqual(['page=1&platform=ps5&language=en&sort=fullest'])
  })

  it('names each control', async () => {
    serveSquads([ranked, flex])
    const { user } = renderSquads('/admin/squads')

    await user.click(await screen.findByRole('button', { name: 'Sort: Newest' }))
    expect(await screen.findByRole('group', { name: 'Sort by' })).toBeVisible()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const [language] = await screen.findAllByRole('group', { name: 'Language' })
    if (!language) throw new Error('The filters have no language switch')
    expect(within(language).getByRole('button', { name: 'All' })).toBeVisible()
    expect(screen.getByRole('radiogroup', { name: 'Platform' })).toBeVisible()
  })

  it('clears the search, Game, platform and language, and keeps the sort', async () => {
    serveSquads([ranked, flex])
    const { user, navigation } = renderSquads(
      `/admin/squads?q=ranked&gameId=${gameCs2.id}&platform=ps5&language=en&sort=oldest&page=2`
    )

    await user.click(await screen.findByRole('button', { name: 'Clear all' }))

    expect(navigation.history.location.search).toBe('?sort=oldest')
    expect(screen.getByRole('searchbox', { name: 'Search squads' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument()
    await expect.poll(() => listReads()).toContain('page=1&sort=oldest')
  })
})

describe('admin squad side panel', () => {
  it('opens from a row with the roster, the host first, and the full invite', async () => {
    serveSquads([ranked, flex])
    serveDetail()
    const { user, navigation } = renderSquads('/admin/squads')

    const panel = await openRanked(user)
    expect(navigation.history.location.search).toBe(`?squad=${RANKED_ID}`)
    expect(panel).toHaveTextContent('Counter-Strike 2 · PC · #VLR7K2')

    const invite = await within(panel).findByRole('link', { name: INVITE })
    expect(invite).toHaveAttribute('href', INVITE)
    expect(invite).toHaveAttribute('target', '_blank')
    expect(invite).toHaveAttribute('rel', 'noopener noreferrer')
    expect(panel).toHaveTextContent('Portuguese')

    const members = within(panel).getAllByRole('listitem')
    expect(members[0]).toHaveTextContent('Diego Alves')
    expect(members[0]).toHaveTextContent('Host')
    expect(members[1]).toHaveTextContent('Marina Rocha')
    expect(within(panel).getByRole('link', { name: 'Open in the app' })).toHaveAttribute(
      'href',
      '/squads/VLR7K2'
    )

    await user.click(within(panel).getByRole('button', { name: 'Close' }))
    expect(navigation.history.location.search).toBe('')
  })

  it('shows a Squad that closed meanwhile as no longer open', async () => {
    serveSquads([ranked])
    onHttp('GET', '/api/admin/squads/:id', () =>
      httpError(404, { error: 'ROOM_NOT_FOUND', message: 'Gone' })
    )
    renderSquads(`/admin/squads?squad=${RANKED_ID}`)

    expect(await screen.findByText('This squad is no longer open')).toBeVisible()
  })
})

describe('admin close squad dialog', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    const panel = await openRanked(user)
    await within(panel).findByRole('link', { name: INVITE })
    await user.click(within(panel).getByRole('button', { name: 'Close squad' }))
    return screen.findByRole('dialog', { name: 'Close “Ranked 5x5 friday”?' })
  }

  it('counts the reason and sends it trimmed once it is long enough', async () => {
    serveSquads([ranked])
    serveDetail()
    onHttp('POST', '/api/admin/squads/:id/close', () => ({ status: 204 }))
    const { user, navigation } = renderSquads('/admin/squads')

    const dialog = await openDialog(user)
    expect(dialog).toHaveTextContent('Irreversible action')
    expect(dialog).toHaveTextContent('The 2 members leave')
    const confirm = within(dialog).getByRole('button', { name: 'Close squad' })
    const reason = within(dialog).getByRole('textbox', { name: 'Reason (visible to members)' })

    await user.type(reason, '  ab ')
    expect(dialog).toHaveTextContent('2/280')
    expect(confirm).toBeDisabled()

    await user.type(reason, 'use of slurs')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await expect
      .poll(() => getHttpLog().find((request) => request.method === 'POST')?.body)
      .toEqual({ reason: 'ab use of slurs' })
    expect(await screen.findByText('“Ranked 5x5 friday” was closed.')).toBeVisible()
    expect(navigation.history.location.search).toBe('')
    expect(
      getHttpLog().filter((request) => request.path === `/api/admin/squads/${RANKED_ID}`)
    ).toHaveLength(1)
  })

  it.each([
    [404, 'ROOM_NOT_FOUND', 'This squad no longer exists or the code is invalid.'],
    [
      422,
      'ROOM_NOT_OPEN',
      'This squad is already full or has expired, so it can no longer be closed.',
    ],
  ])('shows a %i refusal in the dialog and reads the list again', async (status, code, message) => {
    serveSquads([ranked])
    serveDetail()
    onHttp('POST', '/api/admin/squads/:id/close', () => httpError(status, { error: code, message }))
    const { user } = renderSquads('/admin/squads')

    const dialog = await openDialog(user)
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Reason (visible to members)' }),
      'spam'
    )
    const readsBefore = listReads().length
    await user.click(within(dialog).getByRole('button', { name: 'Close squad' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(dialog).toBeInTheDocument()
    await expect.poll(() => listReads().length).toBeGreaterThan(readsBefore)
  })
})
