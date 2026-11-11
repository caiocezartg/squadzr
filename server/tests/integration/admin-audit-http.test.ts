import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { auditEntriesResponseSchema, PAGE_SIZE } from '@squadzr/schemas'
import { auditEntries, user } from '@infrastructure/database/schema'
import { insertAuditEntry } from '@infrastructure/repositories/audit-entry-writer'
import { signIn, type TestUser } from '@test/harness/auth'
import { get } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// #117: GET /api/admin/audit lists the Audit Entries newest first through the shared pagination
// contract, and an entry outlives the people it names.

let server: TestServer
let admin: TestUser

beforeEach(async () => {
  server = await buildTestServer()
  admin = await signIn(server, 'Admin', { role: 'admin' })
})

afterEach(async () => {
  await server.close()
})

const START = new Date('2026-11-01T10:00:00.000Z')

/** Writes one grant entry per minute, oldest first, and returns the target names in that order. */
async function writeGrants(count: number, actor?: TestUser): Promise<string[]> {
  const names: string[] = []
  for (let index = 0; index < count; index += 1) {
    const name = `Target ${String(index + 1).padStart(2, '0')}`
    names.push(name)
    await insertAuditEntry(server.app.db, {
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      action: 'admin_granted',
      target: { type: 'user', id: randomUUID(), name },
      reason: null,
      details: { oldRole: 'user', newRole: 'admin' },
      createdAt: new Date(START.getTime() + index * 60_000),
    })
  }
  return names
}

async function list(page?: number) {
  const response = await get(server, `/api/admin/audit${page ? `?page=${page}` : ''}`, admin)
  expect(response.statusCode, response.body).toBe(200)
  return auditEntriesResponseSchema.parse(response.json())
}

function targetNames(items: Awaited<ReturnType<typeof list>>['items']): (string | undefined)[] {
  return items.map((entry) => entry.target?.name)
}

describe('GET /api/admin/audit', () => {
  it('answers an empty first page with the real total when nothing was audited', async () => {
    expect(await list()).toEqual({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0 })
  })

  it('lists the entries newest first with the shared pagination envelope', async () => {
    const names = await writeGrants(3)

    const body = await list()

    expect(body).toMatchObject({ page: 1, pageSize: 20, total: 3 })
    expect(targetNames(body.items)).toEqual([...names].reverse())
  })

  it('pages through 20 entries at a time', async () => {
    const names = await writeGrants(25)

    const first = await list(1)
    const second = await list(2)

    expect(first.items).toHaveLength(20)
    expect(second.items).toHaveLength(5)
    expect(first.total).toBe(25)
    expect(second.total).toBe(25)
    expect([...targetNames(first.items), ...targetNames(second.items)]).toEqual(
      [...names].reverse()
    )
  })

  it('answers a page past the end with no items and the real total', async () => {
    await writeGrants(3)

    expect(await list(9)).toEqual({ items: [], page: 9, pageSize: PAGE_SIZE, total: 3 })
  })

  it.each(['0', '-2', 'abc', '1.5'])('refuses page=%s with 400', async (page) => {
    const response = await get(server, `/api/admin/audit?page=${page}`, admin)

    expect(response.statusCode).toBe(400)
  })

  it('shows a grant with no actor, and the entry survives the deletion of the person it names', async () => {
    const target = await signIn(server, 'Target')
    await insertAuditEntry(server.app.db, {
      actorId: null,
      actorName: null,
      action: 'admin_granted',
      target: { type: 'user', id: target.id, name: 'Target' },
      reason: null,
      details: { oldRole: 'user', newRole: 'admin' },
      createdAt: START,
    })

    await server.app.db.delete(user).where(eq(user.id, target.id))

    const { items } = await list()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      action: 'admin_granted',
      actorId: null,
      actorName: null,
      target: { type: 'user', id: target.id, name: 'Target' },
      details: { oldRole: 'user', newRole: 'admin' },
      createdAt: START.toISOString(),
    })
  })

  it('keeps the actor name and loses only the reference when the actor is deleted', async () => {
    const actor = await signIn(server, 'Former admin', { role: 'admin' })
    await writeGrants(1, actor)

    await server.app.db.delete(user).where(eq(user.id, actor.id))

    const { items } = await list()
    expect(items[0]).toMatchObject({ actorId: null, actorName: 'Former admin' })
    expect(await server.app.db.select().from(auditEntries)).toHaveLength(1)
  })
})
