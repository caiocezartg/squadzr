import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
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

describe('the guard on the Users endpoints', () => {
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

  it('lets a moderator read the list and a user page, and refuses the role change and the Audit', async () => {
    const mod = await signIn(server, 'Mod', { role: 'moderator' })
    const marina = await signIn(server, 'Marina')

    expect((await get(server, '/api/admin/users', mod)).statusCode).toBe(200)
    expect((await get(server, `/api/admin/users/${marina.id}`, mod)).statusCode).toBe(200)
    const audit = await get(server, '/api/admin/audit', mod)
    expect(audit.statusCode).toBe(403)
    expect(audit.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
    const change = await putRole(marina.id, 'admin', mod)
    expect(change.statusCode).toBe(403)
    expect(change.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
  })

  it('lets the owner into the list, the user page, the Audit and the role change', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })
    const marina = await signIn(server, 'Marina')

    expect((await get(server, '/api/admin/users', owner)).statusCode).toBe(200)
    expect((await get(server, `/api/admin/users/${marina.id}`, owner)).statusCode).toBe(200)
    expect((await get(server, '/api/admin/audit', owner)).statusCode).toBe(200)
    expect((await putRole(marina.id, 'moderator', owner)).statusCode).toBe(200)
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

  it('makes a moderator, who then opens the Users but not the Audit', async () => {
    const marina = await signIn(server, 'Marina')

    const response = await putRole(marina.id, 'moderator')

    expect(response.statusCode, response.body).toBe(200)
    expect(await roleInDatabase(marina.id)).toBe('moderator')
    expect((await get(server, '/api/admin/users', marina)).statusCode).toBe(200)
    expect((await get(server, '/api/admin/audit', marina)).statusCode).toBe(403)
  })

  it('lets an admin change a moderator to user, moderator or admin', async () => {
    const mod = await signIn(server, 'Mod', { role: 'moderator' })

    // Last to admin: once promoted, the account is out of an admin's reach.
    for (const role of ['user', 'moderator', 'admin'] as const) {
      const response = await putRole(mod.id, role)

      expect(response.statusCode, role).toBe(200)
      expect(await roleInDatabase(mod.id)).toBe(role)
    }
  })

  it('lets the owner demote an admin, who loses the admin areas on their very next request', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })

    const response = await putRole(admin.id, 'moderator', owner)

    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toMatchObject({ user: { id: admin.id, role: 'moderator' } })
    expect((await get(server, '/api/admin/audit', admin)).statusCode).toBe(403)
    expect((await get(server, '/api/admin/users', admin)).statusCode).toBe(200)
  })

  it('writes one role_changed entry with the old and new role and a snapshot of both people', async () => {
    const marina = await signIn(server, 'Marina')

    await putRole(marina.id, 'moderator')
    await putRole(marina.id, 'user')

    const entries = await auditEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      action: 'role_changed',
      actorId: admin.id,
      actorName: 'Admin',
      target: { type: 'user', id: marina.id, name: 'Marina' },
      reason: null,
      details: { oldRole: 'moderator', newRole: 'user' },
    })
    expect(entries[1]).toMatchObject({ details: { oldRole: 'user', newRole: 'moderator' } })
  })

  it('keeps the entry readable after the person it names is gone', async () => {
    const marina = await signIn(server, 'Marina')
    await putRole(marina.id, 'admin')

    await server.app.db.delete(user).where(eq(user.id, marina.id))

    expect(await auditEntries()).toMatchObject([
      { target: { type: 'user', id: marina.id, name: 'Marina' } },
    ])
  })

  it('refuses anyone changing their own role, to any role, and writes nothing', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })

    for (const actor of [admin, owner]) {
      for (const role of ['user', 'moderator', 'admin'] as const) {
        const response = await putRole(actor.id, role, actor)

        expect(response.statusCode, actor.id + ' to ' + role).toBe(422)
        expect(response.json()).toMatchObject({ error: 'CANNOT_CHANGE_OWN_ROLE' })
      }
    }
    expect(await roleInDatabase(admin.id)).toBe('admin')
    expect(await roleInDatabase(owner.id)).toBe('owner')
    expect(await auditEntryCount()).toBe(0)
  })

  it('answers 404 USER_NOT_FOUND for an id nobody has, before the own-role rule', async () => {
    const response = await putRole('ghost', 'admin')

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'USER_NOT_FOUND' })
    expect(await auditEntryCount()).toBe(0)
  })

  it('refuses changing the owner with 422 CANNOT_CHANGE_OWNER, whatever role is asked', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })

    for (const role of ['user', 'moderator', 'admin'] as const) {
      const response = await putRole(owner.id, role)

      expect(response.statusCode, role).toBe(422)
      expect(response.json()).toMatchObject({ error: 'CANNOT_CHANGE_OWNER' })
    }
    expect(await roleInDatabase(owner.id)).toBe('owner')
    expect(await auditEntryCount()).toBe(0)
  })

  it('refuses an admin changing another admin with 403 ROLE_CHANGE_FORBIDDEN, even to the role they hold', async () => {
    const second = await signIn(server, 'Second', { role: 'admin' })

    for (const role of ['user', 'moderator', 'admin'] as const) {
      const response = await putRole(second.id, role)

      expect(response.statusCode, role).toBe(403)
      expect(response.json()).toMatchObject({ error: 'ROLE_CHANGE_FORBIDDEN' })
    }
    expect(await roleInDatabase(second.id)).toBe('admin')
    expect(await auditEntryCount()).toBe(0)
  })

  it('never hands out the owner role: the body is refused with 400 whoever asks', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })
    const marina = await signIn(server, 'Marina')

    for (const actor of [admin, owner]) {
      const response = await putRole(marina.id, 'owner', actor)

      expect(response.statusCode).toBe(400)
    }
    expect(await roleInDatabase(marina.id)).toBe('user')
  })

  it('treats the role the person already has as a no-op: 200 and no entry', async () => {
    const marina = await signIn(server, 'Marina')
    const mod = await signIn(server, 'Mod', { role: 'moderator' })

    const asUser = await putRole(marina.id, 'user')
    const asModerator = await putRole(mod.id, 'moderator')

    expect(asUser.statusCode).toBe(200)
    expect(asUser.json()).toMatchObject({ user: { id: marina.id, role: 'user' } })
    expect(asModerator.statusCode).toBe(200)
    expect(asModerator.json()).toMatchObject({ user: { id: mod.id, role: 'moderator' } })
    expect(await auditEntryCount()).toBe(0)
  })

  it.each([{}, { role: 'owner' }, { role: 'root' }, { role: '' }, { role: 1 }])(
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

  it('refuses a moderator or a user with 403 ADMIN_REQUIRED, even for an invalid body', async () => {
    const mod = await signIn(server, 'Mod', { role: 'moderator' })
    const marina = await signIn(server, 'Marina')

    for (const actor of [mod, marina]) {
      const valid = await putRole(marina.id, 'moderator', actor)
      const invalid = await putRole(marina.id, 'nope', actor)

      expect([valid.statusCode, invalid.statusCode]).toEqual([403, 403])
      expect(valid.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
    }
    expect(await roleInDatabase(marina.id)).toBe('user')
  })

  // The owner demotes admin A while A promotes a user. Both queue on A's row: either A's request goes
  // first (both succeed and the user is an admin) or the owner's does and A, re-read inside the
  // transaction as no longer an admin, is refused with 403 ADMIN_REQUIRED and promotes nobody.
  it('leaves one consistent outcome when the owner demotes an admin who is promoting a user', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })
    const marina = await signIn(server, 'Marina')

    for (let round = 0; round < 8; round += 1) {
      await server.app.db.update(user).set({ role: 'admin' }).where(eq(user.id, admin.id))
      await server.app.db.update(user).set({ role: 'user' }).where(eq(user.id, marina.id))
      const before = await auditEntryCount()

      const [demotion, promotion] = await Promise.all([
        putRole(admin.id, 'user', owner),
        putRole(marina.id, 'admin', admin),
      ])

      expect(demotion.statusCode, 'round ' + round).toBe(200)
      expect(await roleInDatabase(admin.id), 'round ' + round).toBe('user')
      if (promotion.statusCode === 200) {
        expect(await roleInDatabase(marina.id), 'round ' + round).toBe('admin')
        expect(await auditEntryCount(), 'round ' + round).toBe(before + 2)
      } else {
        expect(promotion.statusCode, 'round ' + round).toBe(403)
        expect(promotion.json()).toMatchObject({ error: 'ADMIN_REQUIRED' })
        expect(await roleInDatabase(marina.id), 'round ' + round).toBe('user')
        expect(await auditEntryCount(), 'round ' + round).toBe(before + 1)
      }
    }
  })

  it('decides the race inside the transaction, with both requests past the guard', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })
    const marina = await signIn(server, 'Marina')
    const repository = new DrizzleAdminUserRepository(server.app.db)
    const now = new Date()

    for (let round = 0; round < 8; round += 1) {
      await server.app.db.update(user).set({ role: 'admin' }).where(eq(user.id, admin.id))
      await server.app.db.update(user).set({ role: 'user' }).where(eq(user.id, marina.id))

      const [demotion, promotion] = await Promise.all([
        repository.changeRole({ actorId: owner.id, targetId: admin.id, role: 'user', now }),
        repository.changeRole({ actorId: admin.id, targetId: marina.id, role: 'admin', now }),
      ])

      expect(demotion, 'round ' + round).toEqual({ status: 'changed' })
      if (promotion.status === 'changed') {
        expect(await roleInDatabase(marina.id), 'round ' + round).toBe('admin')
      } else {
        expect(promotion, 'round ' + round).toEqual({
          status: 'refused',
          reason: 'actor_not_admin',
        })
        expect(await roleInDatabase(marina.id), 'round ' + round).toBe('user')
      }
    }
  })

  it('writes a single entry when two admins promote the same user at the same time, the second finding an admin it may not touch', async () => {
    const second = await signIn(server, 'Second', { role: 'admin' })
    const marina = await signIn(server, 'Marina')

    const responses = await Promise.all([
      putRole(marina.id, 'admin', admin),
      putRole(marina.id, 'admin', second),
    ])

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 403])
    expect(responses.find((response) => response.statusCode === 403)?.json()).toMatchObject({
      error: 'ROLE_CHANGE_FORBIDDEN',
    })
    expect(await roleInDatabase(marina.id)).toBe('admin')
    expect(await auditEntryCount()).toBe(1)
  })
})
