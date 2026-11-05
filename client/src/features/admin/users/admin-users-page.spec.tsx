/**
 * The admin Users list (#118): the people with their links, the search held in the URL, and the empty,
 * no-match and failed reads. The look at each width is checked in the browser.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, type AdminUserListItemDto, type AdminUsersResponse } from '@squadzr/schemas'
import { createTestQueryClient } from '@/test/harness'
import { getHttpLog, httpError, httpOk, onHttp } from '@/test/http-router'
import { EnglishIntlProvider } from '@/test/intl'
import { createHarnessNavigation } from '@/test/navigation'
import { AdminUsersPage } from './admin-users-page'

const marina: AdminUserListItemDto = {
  id: 'user-marina',
  name: 'Marina Rocha',
  image: null,
  discordId: '284911731173',
  joinedAt: '2026-10-02T12:00:00.000Z',
  role: 'admin',
  openSquads: 2,
}

const diego: AdminUserListItemDto = {
  id: 'user-diego',
  name: 'Diego Alves',
  image: null,
  discordId: null,
  joinedAt: '2026-10-20T12:00:00.000Z',
  role: 'user',
  openSquads: 0,
}

function usersPage(items: readonly AdminUserListItemDto[], page = 1): AdminUsersResponse {
  return { items: [...items], page, pageSize: PAGE_SIZE, total: items.length }
}

/** Answers every read with the people whose name holds the search. */
function serveUsers(people: readonly AdminUserListItemDto[]): void {
  onHttp('GET', '/api/admin/users', ({ query }) => {
    const search = (query.get('q') ?? '').toLowerCase()
    return httpOk(usersPage(people.filter((person) => person.name.toLowerCase().includes(search))))
  })
}

function userReads(): string[] {
  return getHttpLog()
    .filter((request) => request.path === '/api/admin/users')
    .map((request) => request.query.toString())
}

function renderUsers(url: string) {
  const navigation = createHarnessNavigation(url)
  render(
    <EnglishIntlProvider>
      <QueryClientProvider client={createTestQueryClient()}>
        <AdminUsersPage />
      </QueryClientProvider>
    </EnglishIntlProvider>
  )
  return { user: userEvent.setup({ delay: null }), navigation }
}

describe('admin users list', () => {
  it('lists each person with their Discord id, role and Open Squads, linked to their page', async () => {
    serveUsers([marina, diego])
    renderUsers('/admin/users')

    const table = await screen.findByRole('table', { name: 'Users' })
    const [, marinaRow, diegoRow] = within(table).getAllByRole('row')
    if (!marinaRow || !diegoRow) throw new Error('The users table has fewer rows than people')

    expect(within(marinaRow).getByRole('link', { name: 'Marina Rocha' })).toHaveAttribute(
      'href',
      '/admin/users/user-marina'
    )
    expect(marinaRow).toHaveTextContent('284911731173')
    expect(marinaRow).toHaveTextContent('Admin')
    expect(marinaRow).toHaveTextContent('2')
    expect(diegoRow).toHaveTextContent('No Discord account')
    expect(diegoRow).toHaveTextContent('User')

    const phoneList = screen.getByRole('list', { name: 'Users' })
    expect(within(phoneList).getAllByRole('link')).toHaveLength(2)
    expect(phoneList).toHaveTextContent('2 open squads')
  })

  it('starts the field from the URL and writes a new search back to it, on the first page', async () => {
    serveUsers([marina, diego])
    const { user, navigation } = renderUsers('/admin/users?q=mar&page=2')

    const field = screen.getByRole('searchbox', { name: 'Search users' })
    expect(field).toHaveValue('mar')

    await user.clear(field)
    await user.type(field, 'diego')

    expect(
      await screen.findByRole('link', { name: 'Diego Alves' }, { timeout: 2000 })
    ).toBeVisible()
    expect(navigation.history.location.search).toBe('?q=diego')
    expect(userReads()).toEqual(['page=2&q=mar', 'page=1&q=diego'])
  })

  it('says when nobody matches the search, and clears it', async () => {
    serveUsers([marina])
    const { user, navigation } = renderUsers('/admin/users?q=zed')

    expect(await screen.findByRole('heading', { name: 'No users match “zed”' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear the search' }))

    expect(await screen.findByRole('table', { name: 'Users' })).toBeVisible()
    expect(navigation.history.location.search).toBe('')
    expect(screen.getByRole('searchbox', { name: 'Search users' })).toHaveValue('')
  })

  it('says when nobody signed up yet', async () => {
    serveUsers([])
    renderUsers('/admin/users')

    expect(await screen.findByRole('heading', { name: 'No users yet' })).toBeVisible()
  })

  it('shows a failed read with a retry that reads the list again', async () => {
    let fail = true
    onHttp('GET', '/api/admin/users', () =>
      fail
        ? httpError(500, { error: 'INTERNAL_ERROR', message: 'Boom' })
        : httpOk(usersPage([marina]))
    )
    const { user } = renderUsers('/admin/users')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the users.")
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('table', { name: 'Users' })).toBeVisible()
  })
})
