import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { account, auditEntries, user } from '@infrastructure/database/schema'
import { runGrantAdmin, type GrantAdminLogger } from '@interface/admin/grant-admin-entry'
import { FakeClock } from '@test/harness/clock'
import { signIn } from '@test/harness/auth'
import { get } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #117: `admin:grant` makes one person an admin by user id or Discord id, safely and with an audit trail.

let server: TestServer
const clock = new FakeClock(new Date('2026-11-04T09:00:00.000Z'))

beforeEach(async () => {
  server = await buildTestServer()
})

afterEach(async () => {
  await server.close()
})

function capture(): { logger: GrantAdminLogger; infos: string[]; errors: string[] } {
  const infos: string[] = []
  const errors: string[] = []
  return {
    infos,
    errors,
    logger: { info: (message) => infos.push(message), error: (message) => errors.push(message) },
  }
}

function grant(identifier: string, logger: GrantAdminLogger): Promise<number> {
  return runGrantAdmin({ databaseUrl: server.databaseUrl, identifier, clock, logger })
}

function grantAs(
  role: 'admin' | 'owner',
  identifier: string,
  logger: GrantAdminLogger
): Promise<number> {
  return runGrantAdmin({ databaseUrl: server.databaseUrl, identifier, role, clock, logger })
}

async function roleOf(id: string): Promise<string | undefined> {
  const [row] = await server.app.db.select().from(user).where(eq(user.id, id))
  return row?.role
}

describe('admin:grant', () => {
  it('grants the role to a user id and writes one admin_granted entry with no actor', async () => {
    const person = await signIn(server, 'Operator')
    const { logger, infos } = capture()

    expect(await grant(person.id, logger)).toBe(0)

    expect(await roleOf(person.id)).toBe('admin')
    expect(infos).toHaveLength(1)
    expect(await server.app.db.select().from(auditEntries)).toEqual([
      expect.objectContaining({
        action: 'admin_granted',
        actorId: null,
        actorName: null,
        target: { type: 'user', id: person.id, name: 'Operator' },
        details: { oldRole: 'user', newRole: 'admin' },
        createdAt: clock.now(),
      }),
    ])
  })

  it('grants the role to a Discord id', async () => {
    const person = await signIn(server, 'Operator', { discordId: '812345678901234567' })

    expect(await grant('812345678901234567', capture().logger)).toBe(0)

    expect(await roleOf(person.id)).toBe('admin')
    expect(await server.app.db.select().from(auditEntries)).toHaveLength(1)
  })

  it('looks the id up as a user id before a Discord id', async () => {
    const byId = await signIn(server, 'By user id')
    const byDiscord = await signIn(server, 'By Discord id', { discordId: byId.id })

    await grant(byId.id, capture().logger)

    expect(await roleOf(byId.id)).toBe('admin')
    expect(await roleOf(byDiscord.id)).toBe('user')
  })

  it('does not match an account of another provider', async () => {
    const person = await signIn(server, 'Operator')
    await server.app.db.insert(account).values({
      id: 'account-1',
      accountId: 'shared-id',
      providerId: 'github',
      userId: person.id,
    })
    const { logger, errors } = capture()

    expect(await grant('shared-id', logger)).toBe(1)

    expect(errors).toHaveLength(1)
    expect(await roleOf(person.id)).toBe('user')
  })

  it('is a no-op on an existing admin: no second entry', async () => {
    const person = await signIn(server, 'Operator')
    await grant(person.id, capture().logger)
    const { logger, infos } = capture()

    expect(await grant(person.id, logger)).toBe(0)

    expect(infos[0]).toContain('already holds the admin role')
    expect(await server.app.db.select().from(auditEntries)).toHaveLength(1)
  })

  it('never demotes: an admin already in the database stays one, with no entry', async () => {
    const admin = await signIn(server, 'Existing admin', { role: 'admin' })

    expect(await grant(admin.id, capture().logger)).toBe(0)

    expect(await roleOf(admin.id)).toBe('admin')
    expect(await server.app.db.select().from(auditEntries)).toHaveLength(0)
  })

  it('promotes a moderator to admin', async () => {
    const mod = await signIn(server, 'Moderator', { role: 'moderator' })

    expect(await grant(mod.id, capture().logger)).toBe(0)

    expect(await roleOf(mod.id)).toBe('admin')
    expect(await server.app.db.select().from(auditEntries)).toEqual([
      expect.objectContaining({ details: { oldRole: 'moderator', newRole: 'admin' } }),
    ])
  })

  it('makes the owner with the owner role, writing one entry with the old role', async () => {
    const person = await signIn(server, 'Operator', { role: 'admin' })
    const { logger, infos } = capture()

    expect(await grantAs('owner', person.id, logger)).toBe(0)

    expect(await roleOf(person.id)).toBe('owner')
    expect(infos[0]).toContain('Granted the owner role')
    expect(await server.app.db.select().from(auditEntries)).toEqual([
      expect.objectContaining({
        action: 'admin_granted',
        actorId: null,
        details: { oldRole: 'admin', newRole: 'owner' },
      }),
    ])
  })

  it('never demotes the owner when asked for the admin role', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })

    expect(await grant(owner.id, capture().logger)).toBe(0)

    expect(await roleOf(owner.id)).toBe('owner')
    expect(await server.app.db.select().from(auditEntries)).toHaveLength(0)
  })

  it('is a no-op for the person who already is the owner', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })

    expect(await grantAs('owner', owner.id, capture().logger)).toBe(0)

    expect(await roleOf(owner.id)).toBe('owner')
    expect(await server.app.db.select().from(auditEntries)).toHaveLength(0)
  })

  it('refuses a second owner and writes nothing', async () => {
    const owner = await signIn(server, 'Owner', { role: 'owner' })
    const other = await signIn(server, 'Other')
    const { logger, errors } = capture()

    expect(await grantAs('owner', other.id, logger)).toBe(1)

    expect(errors[0]).toContain('already the owner')
    expect(await roleOf(owner.id)).toBe('owner')
    expect(await roleOf(other.id)).toBe('user')
    expect(await server.app.db.select().from(auditEntries)).toHaveLength(0)
  })

  it('reports an unknown id and writes nothing', async () => {
    const person = await signIn(server, 'Operator')
    const { logger, errors } = capture()

    expect(await grant('nobody', logger)).toBe(1)

    expect(errors[0]).toContain('nobody')
    expect(await roleOf(person.id)).toBe('user')
    expect(await server.app.db.select().from(auditEntries)).toHaveLength(0)
  })

  it('writes exactly one entry when two grants race', async () => {
    const person = await signIn(server, 'Operator')

    const codes = await Promise.all([
      grant(person.id, capture().logger),
      grant(person.id, capture().logger),
    ])

    expect(codes).toEqual([0, 0])
    expect(await server.app.db.select().from(auditEntries)).toHaveLength(1)
  })

  it('opens the audit page to the new admin on their next request, with the grant on it', async () => {
    const person = await signIn(server, 'Operator')
    expect((await get(server, '/api/admin/audit', person)).statusCode).toBe(403)

    await grant(person.id, capture().logger)

    const after = await get(server, '/api/admin/audit', person)
    expect(after.statusCode).toBe(200)
    expect(after.json()).toMatchObject({
      total: 1,
      items: [{ action: 'admin_granted', actorId: null, actorName: null }],
    })
  })
})
