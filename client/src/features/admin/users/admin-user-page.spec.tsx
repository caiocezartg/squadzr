/**
 * One person's admin page (#118): what support needs about them, the role switch with its confirmation
 * and refusals, the roles each viewer may give, the locks (own page, the owner, an admin seen by an
 * admin), the read-only role a moderator sees, and a person that does not exist.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AdminUserDetailDto, UserRole } from '@squadzr/schemas'
import { createTestQueryClient } from '@/test/harness'
import { getHttpLog, httpError, httpOk, onHttp } from '@/test/http-router'
import { EnglishIntlProvider } from '@/test/intl'
import { createHarnessNavigation } from '@/test/navigation'
import { fakeSession, signInAsFakeUser, toastStore } from '@/test/stubs'
import { AdminUserPage } from './admin-user-page'

const VIEWER_ID = 'user-viewer'

const valorant = {
  id: '7f1c2a4e-5b6d-4c8e-9f0a-1b2c3d4e5f60',
  name: 'Valorant',
  slug: 'valorant',
  coverUrl: 'https://images.test/valorant.jpg',
  coverThumbUrl: 'https://images.test/valorant-thumb.jpg',
}

function marina(role: UserRole = 'user', id = 'user-marina'): AdminUserDetailDto {
  return {
    id,
    name: 'Marina Rocha',
    image: null,
    discordId: '284911731173',
    joinedAt: '2026-10-02T12:00:00.000Z',
    role,
    online: true,
    squadLimits: { held: { used: 2, limit: 3 }, hosted: { used: 1, limit: 1 } },
    openSquads: [
      {
        id: 'squad-1',
        code: 'VLR7K2',
        name: 'Ranked 5x5',
        game: valorant,
        memberCount: 4,
        maxPlayers: 5,
        isHost: true,
      },
    ],
    completedSquads: 47,
    gamesPlayed: 6,
    latestCompleted: [
      {
        id: 'record-1',
        name: 'Unrated chill',
        game: valorant,
        maxPlayers: 5,
        readyAt: '2026-11-03T20:00:00.000Z',
      },
    ],
  }
}

/** Serves a person whose role the PUT changes, as the server would. */
function servePerson(person: AdminUserDetailDto): void {
  let role = person.role
  onHttp('GET', `/api/admin/users/${person.id}`, () => httpOk({ user: { ...person, role } }))
  onHttp('PUT', `/api/admin/users/${person.id}/role`, ({ body }) => {
    role = (body as { role: UserRole }).role
    return httpOk({ user: { ...person, role } })
  })
}

function roleWrites(): unknown[] {
  return getHttpLog()
    .filter((request) => request.method === 'PUT')
    .map((request) => request.body)
}

function renderPerson(id: string, viewerRole: UserRole = 'admin') {
  signInAsFakeUser({ id: VIEWER_ID, role: viewerRole })
  createHarnessNavigation(`/admin/users/${id}`)
  render(
    <EnglishIntlProvider session={fakeSession()}>
      <QueryClientProvider client={createTestQueryClient()}>
        <AdminUserPage id={id} />
      </QueryClientProvider>
    </EnglishIntlProvider>
  )
  return userEvent.setup({ delay: null })
}

function roleGroup(): HTMLElement {
  return screen.getByRole('group', { name: 'Role' })
}

function roleOptions(): (string | null)[] {
  return within(roleGroup())
    .getAllByRole('button')
    .map((button) => button.textContent)
}

function expectLocked(reason: string): void {
  for (const button of within(roleGroup()).getAllByRole('button')) expect(button).toBeDisabled()
  expect(roleGroup()).toHaveAccessibleDescription(reason)
}

describe('admin user page', () => {
  it('shows who the person is, their limits, their Open Squads and what they completed', async () => {
    servePerson(marina())
    renderPerson('user-marina')

    expect(await screen.findByRole('heading', { level: 1, name: 'Marina Rocha' })).toBeVisible()
    expect(screen.getByText('Discord ID · 284911731173')).toBeVisible()
    expect(screen.getByText('Online now')).toBeVisible()
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(screen.getByText('1 of 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ranked 5x5\s*Host/ })).toHaveAttribute(
      'href',
      '/squads/VLR7K2'
    )
    expect(screen.getByRole('list', { name: 'Latest completed squads' })).toHaveTextContent(
      'Unrated chill'
    )
    const identity = screen.getByRole('region', { name: 'Marina Rocha' })
    const counters = within(identity).getByRole('region', { name: 'Squad limits' })
    expect(counters).toHaveTextContent(/Completed squads\s*47/)
    expect(counters).toHaveTextContent(/Games\s*6/)
    expect(counters).toHaveTextContent(/Open squads.*2 of 3/)
    expect(screen.getByRole('link', { name: 'All users' })).toHaveAttribute('href', '/admin/users')
  })

  it('locks the role on the viewer’s own page and says why', async () => {
    servePerson(marina('admin', VIEWER_ID))
    renderPerson(VIEWER_ID)

    await screen.findByRole('heading', { level: 1, name: 'Marina Rocha' })
    expectLocked("You can't change your own role.")
  })

  it('offers the owner the three roles for another person', async () => {
    servePerson(marina('admin'))
    renderPerson('user-marina', 'owner')

    await screen.findByRole('heading', { level: 1, name: 'Marina Rocha' })
    expect(roleOptions()).toEqual(['User', 'Moderator', 'Admin'])
    for (const button of within(roleGroup()).getAllByRole('button')) expect(button).toBeEnabled()
  })

  it.each<UserRole>(['user', 'moderator'])(
    'offers an admin the three roles for a %s',
    async (role) => {
      servePerson(marina(role))
      renderPerson('user-marina', 'admin')

      await screen.findByRole('heading', { level: 1, name: 'Marina Rocha' })
      expect(roleOptions()).toEqual(['User', 'Moderator', 'Admin'])
      for (const button of within(roleGroup()).getAllByRole('button')) expect(button).toBeEnabled()
    }
  )

  it('locks another admin’s role for an admin and says only the owner changes it', async () => {
    servePerson(marina('admin'))
    renderPerson('user-marina', 'admin')

    await screen.findByRole('heading', { level: 1, name: 'Marina Rocha' })
    expectLocked("Only the owner can change an admin's role.")
  })

  it.each<UserRole>(['admin', 'owner'])(
    'locks the owner’s role for an %s viewer and says why',
    async (viewerRole) => {
      servePerson(marina('owner'))
      renderPerson('user-marina', viewerRole)

      await screen.findByRole('heading', { level: 1, name: 'Marina Rocha' })
      expect(within(roleGroup()).getByRole('button', { name: 'Owner' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expectLocked("The owner's role cannot be changed.")
    }
  )

  it('shows a moderator the role as a pill, with no switch', async () => {
    servePerson(marina('admin'))
    renderPerson('user-marina', 'moderator')

    await screen.findByRole('heading', { level: 1, name: 'Marina Rocha' })
    expect(screen.queryByRole('group', { name: 'Role' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Role' })).toHaveTextContent('Admin')
  })

  it('asks before making a person a moderator', async () => {
    servePerson(marina())
    const user = renderPerson('user-marina', 'owner')

    await user.click(await screen.findByRole('button', { name: 'Moderator' }))
    const dialog = await screen.findByRole('dialog', { name: 'Make Marina Rocha a moderator?' })
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Marina Rocha is now a moderator.')
    expect(roleWrites()).toEqual([{ role: 'moderator' }])
  })

  it('asks before a role change, then sends it and shows the new role', async () => {
    servePerson(marina())
    const user = renderPerson('user-marina')

    await user.click(await screen.findByRole('button', { name: 'Admin' }))
    const dialog = await screen.findByRole('dialog', { name: 'Make Marina Rocha an admin?' })
    expect(roleWrites()).toEqual([])

    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Marina Rocha is now an admin.')
    expect(roleWrites()).toEqual([{ role: 'admin' }])
    expect(within(roleGroup()).getByRole('button', { name: 'Admin' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('sends nothing when the change is cancelled', async () => {
    servePerson(marina())
    const user = renderPerson('user-marina')

    await user.click(await screen.findByRole('button', { name: 'Admin' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(roleWrites()).toEqual([])
    expect(within(roleGroup()).getByRole('button', { name: 'User' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it.each([
    [422, 'CANNOT_CHANGE_OWNER', "The owner's role cannot be changed."],
    [403, 'ROLE_CHANGE_FORBIDDEN', 'Your role does not allow this change.'],
  ])('shows why the server refused the change (%i %s)', async (status, error, message) => {
    servePerson(marina('moderator'))
    onHttp('PUT', '/api/admin/users/user-marina/role', () =>
      httpError(status, { error, message: 'Refused' })
    )
    const user = renderPerson('user-marina')

    await user.click(await screen.findByRole('button', { name: 'User' }))
    const dialog = await screen.findByRole('dialog', { name: 'Make Marina Rocha a user?' })
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await expect.poll(() => toastStore.errorCalls).toEqual([message])
  })

  it('says when the person does not exist and leads back to the list', async () => {
    onHttp('GET', '/api/admin/users/user-gone', () =>
      httpError(404, { error: 'USER_NOT_FOUND', message: 'Not found' })
    )
    renderPerson('user-gone')

    expect(await screen.findByRole('heading', { level: 1, name: 'User not found' })).toBeVisible()
    expect(screen.getAllByRole('link', { name: 'All users' })[0]).toHaveAttribute(
      'href',
      '/admin/users'
    )
  })
})
