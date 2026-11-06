import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import {
  PAGE_SIZE,
  adminUserResponseSchema,
  adminUsersResponseSchema,
  auditEntriesResponseSchema,
  changeUserRoleResponseSchema,
  type UserRole,
} from '@squadzr/schemas'
import { auditEntries as auditEntriesTable, user } from '@infrastructure/database/schema'
import { signIn, type TestUser } from '@test/harness/auth'
import { connect } from '@test/harness/realtime'
import {
  createRoom,
  get,
  insertGame,
  joinAll,
  roomAction,
  setRoomLifecycle,
} from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'
import { DrizzleAdminUserRepository } from '@infrastructure/repositories/drizzle-admin-user.repository'

// #118: the admin panel's Users. A list an admin can search, a user page that answers support
// questions, and a role change the server polices (nobody changes their own role, the first request to
// win a race between two admins decides) with one Audit Entry per change.

let server: TestServer
let admin: TestUser

beforeEach(async () => {
  server = await buildTestServer()
  admin = await signIn(server, 'Admin', { role: 'admin' })
})

afterEach(async () => {
  await server.close()
})

const DAY_MS = 24 * 60 * 60_000

async function listUsers(query = '', as: TestUser = admin) {
  const response = await get(server, `/api/admin/users${query}`, as)
  expect(response.statusCode, response.body).toBe(200)
  return adminUsersResponseSchema.parse(response.json())
}

async function userPage(id: string, as: TestUser = admin) {
  const response = await get(server, `/api/admin/users/${id}`, as)
  expect(response.statusCode, response.body).toBe(200)
  return adminUserResponseSchema.parse(response.json()).user
}

function putRole(target: string, role: unknown, as: TestUser | null = admin) {
  return server.app.inject({
    method: 'PUT',
    url: `/api/admin/users/${target}/role`,
    headers: as?.headers,
    payload: { role },
  })
}

async function auditEntries() {
  const response = await get(server, '/api/admin/audit', admin)
  expect(response.statusCode, response.body).toBe(200)
  return auditEntriesResponseSchema.parse(response.json()).items
}

async function roleInDatabase(id: string): Promise<UserRole | undefined> {
  const [row] = await server.app.db.select({ role: user.role }).from(user).where(eq(user.id, id))
  return row?.role
}

/** How many entries the audit holds, read from the table: the admins of a race may both lose access. */
async function auditEntryCount(): Promise<number> {
  return (await server.app.db.select().from(auditEntriesTable)).length
}

/** Places the users' sign-up instants one minute apart, the first listed the oldest. */
async function spaceSignUps(people: TestUser[]): Promise<void> {
  const start = Date.parse('2026-01-01T00:00:00.000Z')
  for (const [index, person] of people.entries()) {
    await server.app.db
      .update(user)
      .set({ createdAt: new Date(start + index * 60_000) })
      .where(eq(user.id, person.id))
  }
}

describe('the admin guard on the Users endpoints', () => {
  it('answers 401 signed out and 403 ADMIN_REQUIRED for a user, before validating anything', async () => {
    const player = await signIn(server, 'Player')
    const requests = [
      { method: 'GET', url: '/api/admin/users?page=0' },
      { method: 'GET', url: `/api/admin/users/${player.id}` },
      { method: 'PUT', url: `/api/admin/users/${player.id}/role`, payload: { role: 'nope' } },
    ] as const

    for (const request of requests) {
      const signedOut = await server.app.inject(request)
      expect(signedOut.statusCode, `${request.method} ${request.url}`).toBe(401)

      const asUser = await server.app.inject({ ...request, headers: player.headers })
      expect(asUser.statusCode, `${request.method} ${request.url}`).toBe(403)
      expect(asUser.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
    }
  })
})

describe('GET /api/admin/users', () => {
  it('lists users newest first with their avatar, name, Discord id, joined date, role and Open Squads', async () => {
    const [marina, caio] = await Promise.all([
      signIn(server, 'Marina Rocha', { discordId: '284917263100001173' }),
      signIn(server, 'Caio'),
    ])
    await spaceSignUps([admin, marina, caio])

    const body = await listUsers()

    expect(body).toMatchObject({ page: 1, pageSize: PAGE_SIZE, total: 3 })
    expect(body.items.map((row) => row.name)).toEqual(['Caio', 'Marina Rocha', 'Admin'])
    expect(body.items[1]).toEqual({
      id: marina.id,
      name: 'Marina Rocha',
      image: marina.image,
      discordId: '284917263100001173',
      joinedAt: '2026-01-01T00:01:00.000Z',
      role: 'user',
      openSquads: 0,
    })
    expect(body.items[0]?.discordId).toBeNull()
    expect(body.items[2]?.role).toBe('admin')
  })

  it('finds a user by part of the name, ignoring case', async () => {
    const marina = await signIn(server, 'Marina Rocha')
    await signIn(server, 'Caio')

    const body = await listUsers('?q=ARIN')

    expect(body.items.map((row) => row.id)).toEqual([marina.id])
    expect(body.total).toBe(1)
  })

  it('takes the wildcard characters of a search literally', async () => {
    await signIn(server, 'Marina Rocha')
    const percent = await signIn(server, '100% Sure')

    expect((await listUsers('?q=%25')).items.map((row) => row.id)).toEqual([percent.id])
    expect((await listUsers('?q=_')).items).toEqual([])
  })

  it('finds a user by their exact Discord id, and not by a part of it', async () => {
    const marina = await signIn(server, 'Marina Rocha', { discordId: '284917263100001173' })
    await signIn(server, 'Caio', { discordId: '999000111222333444' })

    expect((await listUsers('?q=284917263100001173')).items.map((row) => row.id)).toEqual([
      marina.id,
    ])
    expect((await listUsers('?q=2849172631')).items).toEqual([])
  })

  it('finds a user by their exact user id, and not by a part of it', async () => {
    const marina = await signIn(server, 'Marina Rocha')

    expect((await listUsers(`?q=${marina.id}`)).items.map((row) => row.id)).toEqual([marina.id])
    expect((await listUsers(`?q=${marina.id.slice(0, 8)}`)).items).toEqual([])
  })

  it('lists everyone for an empty search and nobody for a search that matches nothing', async () => {
    await signIn(server, 'Marina Rocha')

    expect((await listUsers('?q=')).total).toBe(2)
    expect(await listUsers('?q=zzz-nobody')).toMatchObject({ items: [], total: 0 })
  })

  it('pages through 20 users at a time, and answers a page past the end with the real total', async () => {
    const people = await Promise.all(
      Array.from({ length: 24 }, (_, index) => signIn(server, `Player ${index + 1}`))
    )
    await spaceSignUps([admin, ...people])

    const first = await listUsers('?page=1')
    const second = await listUsers('?page=2')
    const beyond = await listUsers('?page=9')

    expect(first.items).toHaveLength(20)
    expect(second.items).toHaveLength(5)
    expect(new Set([...first.items, ...second.items].map((row) => row.id)).size).toBe(25)
    expect([first.total, second.total]).toEqual([25, 25])
    expect(beyond).toEqual({ items: [], page: 9, pageSize: PAGE_SIZE, total: 25 })
  })

  it.each(['?page=0', '?page=abc', `?q=${'x'.repeat(101)}`])(
    'refuses %s with 400',
    async (query) => {
      const response = await get(server, `/api/admin/users${query}`, admin)

      expect(response.statusCode).toBe(400)
    }
  )

  it('counts a person’s valid Open Squads only: not a Ready one and not one past its activity window', async () => {
    const game = await insertGame(server, 2)
    const wide = await insertGame(server, 5)
    const [host, mate, other] = await Promise.all([
      signIn(server, 'Host'),
      signIn(server, 'Mate'),
      signIn(server, 'Other'),
    ])
    // Ready: the final join completes it, and the Squad Release has nothing else to release.
    const ready = await createRoom(server, host, { gameId: game.id, maxPlayers: 2 })
    await joinAll(server, ready.code, [mate])
    // Open and past its window: its Membership no longer counts.
    const expired = await createRoom(server, other, { gameId: wide.id })
    await roomAction(server, host, expired.code, 'join')
    await setRoomLifecycle(server, expired.id, {
      createdAt: new Date(Date.now() - 3 * DAY_MS),
      lastActivityAt: new Date(Date.now() - 2 * DAY_MS),
      readyAt: null,
    })
    // Open and valid: hosted by `host`.
    await createRoom(server, host, { gameId: wide.id })

    const rows = new Map((await listUsers()).items.map((row) => [row.id, row.openSquads]))

    // `host` holds one valid Membership (the Squad they host); the Ready Squad and the expired Squad
    // they joined no longer count. `other` only hosts the expired one.
    expect(rows.get(host.id)).toBe(1)
    expect(rows.get(mate.id)).toBe(0)
    expect(rows.get(other.id)).toBe(0)
  })

  it('never carries an email', async () => {
    const marina = await signIn(server, 'Marina Rocha', { discordId: '284917263100001173' })

    const response = await get(server, '/api/admin/users', admin)

    expect(response.body).not.toContain('@squadzr.test')
    expect(response.body).not.toContain('email')
    expect(response.body).not.toContain(marina.email)
  })
})

describe('GET /api/admin/users/:id', () => {
  it('answers 404 USER_NOT_FOUND for an id nobody has', async () => {
    const response = await get(server, '/api/admin/users/ghost', admin)

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'USER_NOT_FOUND' })
  })

  it('shows who they are, with no Open Squads and no history yet', async () => {
    const marina = await signIn(server, 'Marina Rocha', { discordId: '284917263100001173' })

    const page = await userPage(marina.id)

    expect(page).toMatchObject({
      id: marina.id,
      name: 'Marina Rocha',
      image: marina.image,
      discordId: '284917263100001173',
      role: 'user',
      online: false,
      squadLimits: { held: { used: 0, limit: 3 }, hosted: { used: 0, limit: 1 } },
      openSquads: [],
      completedSquads: 0,
      gamesPlayed: 0,
      latestCompleted: [],
    })
    expect(Number.isNaN(Date.parse(page.joinedAt))).toBe(false)
  })

  it('shows the Squad Limits usage and the current Open Squads, marking the hosted ones', async () => {
    const game = await insertGame(server, 5)
    const [marina, other] = await Promise.all([signIn(server, 'Marina'), signIn(server, 'Other')])
    const hosted = await createRoom(server, marina, { gameId: game.id, name: 'Hosted by Marina' })
    const joined = await createRoom(server, other, { gameId: game.id, name: 'Marina is a member' })
    await roomAction(server, marina, joined.code, 'join')

    const page = await userPage(marina.id)

    expect(page.squadLimits).toEqual({
      held: { used: 2, limit: 3 },
      hosted: { used: 1, limit: 1 },
    })
    expect(page.openSquads).toHaveLength(2)
    expect(page.openSquads.find((squad) => squad.code === hosted.code)).toMatchObject({
      name: 'Hosted by Marina',
      isHost: true,
      memberCount: 1,
      maxPlayers: 5,
      game: { id: game.id, name: game.name },
    })
    expect(page.openSquads.find((squad) => squad.code === joined.code)).toMatchObject({
      isHost: false,
      memberCount: 2,
    })
  })

  it('counts completed Squads and Games and lists the latest five, newest first', async () => {
    const [valorant, league] = await Promise.all([insertGame(server, 2), insertGame(server, 2)])
    const marina = await signIn(server, 'Marina')
    const mates = await Promise.all(
      Array.from({ length: 6 }, (_, index) => signIn(server, `Mate ${index + 1}`))
    )
    const names: string[] = []
    for (const [index, mate] of mates.entries()) {
      const name = `Completed ${index + 1}`
      names.push(name)
      const room = await createRoom(server, marina, {
        gameId: index % 3 === 0 ? league.id : valorant.id,
        maxPlayers: 2,
        name,
      })
      await joinAll(server, room.code, [mate])
    }

    const page = await userPage(marina.id)

    expect(page.completedSquads).toBe(6)
    expect(page.gamesPlayed).toBe(2)
    expect(page.latestCompleted).toHaveLength(5)
    expect(page.latestCompleted.map((squad) => squad.name)).toEqual(
      [...names].reverse().slice(0, 5)
    )
    expect(page.openSquads).toEqual([])
  })

  it('knows a person is online while they hold a realtime connection, and offline after', async () => {
    const marina = await signIn(server, 'Marina')
    expect((await userPage(marina.id)).online).toBe(false)

    const guest = await connect(server)
    const connection = await connect(server, marina)
    expect((await userPage(marina.id)).online).toBe(true)
    expect((await userPage(admin.id)).online).toBe(false)

    connection.client.terminate()
    await vi.waitFor(async () => expect((await userPage(marina.id)).online).toBe(false))
    guest.client.terminate()
  })

  it('never carries an email', async () => {
    const marina = await signIn(server, 'Marina Rocha')

    const response = await get(server, `/api/admin/users/${marina.id}`, admin)

    expect(response.body).not.toContain(marina.email)
    expect(response.body).not.toContain('email')
  })
})

describe('PUT /api/admin/users/:id/role', () => {
  it('promotes a user, who is then an admin on their very next request', async () => {
    const marina = await signIn(server, 'Marina')
    expect((await get(server, '/api/admin/users', marina)).statusCode).toBe(403)

    const response = await putRole(marina.id, 'admin')

    expect(response.statusCode, response.body).toBe(200)
    expect(changeUserRoleResponseSchema.parse(response.json()).user).toMatchObject({
      id: marina.id,
      name: 'Marina',
      role: 'admin',
    })
    expect(await roleInDatabase(marina.id)).toBe('admin')
    expect((await get(server, '/api/admin/users', marina)).statusCode).toBe(200)
  })

  it('demotes another admin, who loses access on their very next request', async () => {
    const second = await signIn(server, 'Second', { role: 'admin' })

    const response = await putRole(second.id, 'user')

    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toMatchObject({ user: { id: second.id, role: 'user' } })
    expect((await get(server, '/api/admin/users', second)).statusCode).toBe(403)
  })

  it('writes one role_changed entry with the old and new role and a snapshot of both people', async () => {
    const marina = await signIn(server, 'Marina')

    await putRole(marina.id, 'admin')
    await putRole(marina.id, 'user')

    const entries = await auditEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      action: 'role_changed',
      actorId: admin.id,
      actorName: 'Admin',
      target: { type: 'user', id: marina.id, name: 'Marina' },
      reason: null,
      details: { oldRole: 'admin', newRole: 'user' },
    })
    expect(entries[1]).toMatchObject({ details: { oldRole: 'user', newRole: 'admin' } })
  })

  it('keeps the entry readable after the person it names is gone', async () => {
    const marina = await signIn(server, 'Marina')
    await putRole(marina.id, 'admin')

    await server.app.db.delete(user).where(eq(user.id, marina.id))

    expect(await auditEntries()).toMatchObject([
      { target: { type: 'user', id: marina.id, name: 'Marina' } },
    ])
  })

  // The last_admin rule is defense in depth: an admin actor demoting a distinct admin implies at least
  // two admins, so it cannot be reached through this endpoint. role-change.spec.ts and the use-case
  // spec cover it.
  it('refuses an admin changing their own role, to either role, and writes nothing', async () => {
    const second = await signIn(server, 'Second', { role: 'admin' })

    for (const role of ['user', 'admin'] as const) {
      const response = await putRole(admin.id, role)

      expect(response.statusCode).toBe(422)
      expect(response.json()).toMatchObject({ error: 'CANNOT_CHANGE_OWN_ROLE' })
    }
    expect(await roleInDatabase(admin.id)).toBe('admin')
    expect(await roleInDatabase(second.id)).toBe('admin')
    expect(await auditEntries()).toEqual([])
  })

  it('answers 404 USER_NOT_FOUND for an id nobody has, before the own-role rule', async () => {
    const response = await putRole('ghost', 'admin')

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'USER_NOT_FOUND' })
    expect(await auditEntries()).toEqual([])
  })

  it('treats the role the person already has as a no-op: 200 and no entry', async () => {
    const marina = await signIn(server, 'Marina')
    const second = await signIn(server, 'Second', { role: 'admin' })

    const asUser = await putRole(marina.id, 'user')
    const asAdmin = await putRole(second.id, 'admin')

    expect(asUser.statusCode).toBe(200)
    expect(asUser.json()).toMatchObject({ user: { id: marina.id, role: 'user' } })
    expect(asAdmin.statusCode).toBe(200)
    expect(asAdmin.json()).toMatchObject({ user: { id: second.id, role: 'admin' } })
    expect(await auditEntries()).toEqual([])
  })

  it.each([{}, { role: 'owner' }, { role: '' }, { role: 1 }])(
    'refuses the body %j with 400',
    async (body) => {
      const marina = await signIn(server, 'Marina')

      const response = await server.app.inject({
        method: 'PUT',
        url: `/api/admin/users/${marina.id}/role`,
        headers: admin.headers,
        payload: body,
      })

      expect(response.statusCode).toBe(400)
    }
  )

  it('leaves exactly one admin when two admins demote each other at the same time', async () => {
    const second = await signIn(server, 'Second', { role: 'admin' })

    for (let round = 0; round < 5; round += 1) {
      await server.app.db
        .update(user)
        .set({ role: 'admin' })
        .where(inArray(user.id, [admin.id, second.id]))
      const before = await auditEntryCount()

      const [firstDemotesSecond, secondDemotesFirst] = await Promise.all([
        putRole(second.id, 'user', admin),
        putRole(admin.id, 'user', second),
      ])

      expect(
        [firstDemotesSecond.statusCode, secondDemotesFirst.statusCode].sort(),
        `round ${round}`
      ).toEqual([200, 403])
      const loser = firstDemotesSecond.statusCode === 200 ? secondDemotesFirst : firstDemotesSecond
      expect(loser.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
      const roles = await Promise.all([roleInDatabase(admin.id), roleInDatabase(second.id)])
      expect(
        roles.filter((role) => role === 'admin'),
        `round ${round}`
      ).toHaveLength(1)
      expect(await auditEntryCount(), `round ${round}`).toBe(before + 1)
    }
  })

  it('decides the race inside the transaction, with both requests past the guard', async () => {
    const second = await signIn(server, 'Second', { role: 'admin' })
    const repository = new DrizzleAdminUserRepository(server.app.db)
    const now = new Date()

    for (let round = 0; round < 5; round += 1) {
      await server.app.db
        .update(user)
        .set({ role: 'admin' })
        .where(inArray(user.id, [admin.id, second.id]))

      const outcomes = await Promise.all([
        repository.changeRole({ actorId: admin.id, targetId: second.id, role: 'user', now }),
        repository.changeRole({ actorId: second.id, targetId: admin.id, role: 'user', now }),
      ])

      expect(outcomes.map((outcome) => outcome.status).sort(), `round ${round}`).toEqual([
        'changed',
        'refused',
      ])
      expect(outcomes.find((outcome) => outcome.status === 'refused')).toEqual({
        status: 'refused',
        reason: 'actor_not_admin',
      })
      const roles = await Promise.all([roleInDatabase(admin.id), roleInDatabase(second.id)])
      expect(
        roles.filter((role) => role === 'admin'),
        `round ${round}`
      ).toHaveLength(1)
    }
  })

  it('writes a single entry when two admins promote the same user at the same time', async () => {
    const second = await signIn(server, 'Second', { role: 'admin' })
    const marina = await signIn(server, 'Marina')

    const responses = await Promise.all([
      putRole(marina.id, 'admin', admin),
      putRole(marina.id, 'admin', second),
    ])

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200])
    expect(await roleInDatabase(marina.id)).toBe('admin')
    expect(await auditEntries()).toHaveLength(1)
  })
})
