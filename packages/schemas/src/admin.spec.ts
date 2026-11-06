import { describe, expect, it } from 'vitest'
import {
  PAGE_SIZE,
  auditEntriesResponseSchema,
  auditEntrySchema,
  canAccessAdminPanel,
  grantableRoles,
  hasFullAdminAccess,
  pageQuerySchema,
  paginatedResponseSchema,
  assignableRoleSchema,
  userRoleSchema,
} from './index'
import { z } from 'zod'

const CREATED_AT = '2026-11-04T12:30:00.000Z'
const ENTRY_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

const grantEntry = {
  id: ENTRY_ID,
  action: 'admin_granted',
  actorId: null,
  actorName: null,
  target: { type: 'user', id: 'user-1', name: 'Caio' },
  reason: null,
  details: { oldRole: 'user', newRole: 'admin' },
  createdAt: CREATED_AT,
}

describe('pageQuerySchema', () => {
  it('defaults to the first page and coerces the query string', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1 })
    expect(pageQuerySchema.parse({ page: '3' })).toEqual({ page: 3 })
  })

  it.each(['0', '-1', '1.5', 'abc', '', '99999999999'])('rejects page %j', (page) => {
    expect(pageQuerySchema.safeParse({ page }).success).toBe(false)
  })
})

describe('paginatedResponseSchema', () => {
  const schema = paginatedResponseSchema(z.object({ id: z.string() }))

  it('carries the items, the page, the fixed page size and the total', () => {
    const body = { items: [{ id: 'a' }], page: 2, pageSize: PAGE_SIZE, total: 21 }

    expect(PAGE_SIZE).toBe(20)
    expect(schema.parse(body)).toEqual(body)
  })

  it('accepts a page past the end: empty items with the real total', () => {
    expect(schema.safeParse({ items: [], page: 9, pageSize: PAGE_SIZE, total: 21 }).success).toBe(
      true
    )
  })

  it.each([
    ['another page size', { items: [], page: 1, pageSize: 50, total: 0 }],
    ['a page below 1', { items: [], page: 0, pageSize: PAGE_SIZE, total: 0 }],
    ['a negative total', { items: [], page: 1, pageSize: PAGE_SIZE, total: -1 }],
    ['a missing total', { items: [], page: 1, pageSize: PAGE_SIZE }],
  ])('rejects %s', (_, body) => {
    expect(schema.safeParse(body).success).toBe(false)
  })
})

describe('userRoleSchema', () => {
  it('knows user, moderator, admin and owner only', () => {
    expect(userRoleSchema.options).toEqual(['user', 'moderator', 'admin', 'owner'])
  })

  it('never hands out owner in a role change', () => {
    expect(assignableRoleSchema.options).toEqual(['user', 'moderator', 'admin'])
  })
})

describe('role permissions', () => {
  it.each([
    ['user', false, false],
    ['moderator', true, false],
    ['admin', true, true],
    ['owner', true, true],
    [null, false, false],
    [undefined, false, false],
  ] as const)('%s: panel %s, admin areas %s', (role, panel, full) => {
    expect(canAccessAdminPanel(role)).toBe(panel)
    expect(hasFullAdminAccess(role)).toBe(full)
  })

  it.each([
    ['owner', 'user', ['user', 'moderator', 'admin']],
    ['owner', 'moderator', ['user', 'moderator', 'admin']],
    ['owner', 'admin', ['user', 'moderator', 'admin']],
    ['owner', 'owner', []],
    ['admin', 'user', ['user', 'moderator', 'admin']],
    ['admin', 'moderator', ['user', 'moderator', 'admin']],
    ['admin', 'admin', []],
    ['admin', 'owner', []],
    ['moderator', 'user', []],
    ['user', 'user', []],
    [null, 'user', []],
    ['owner', null, []],
  ] as const)('%s changing a %s may grant %j', (actor, target, granted) => {
    expect(grantableRoles(actor, target)).toEqual(granted)
  })
})

describe('auditEntrySchema', () => {
  it('parses a grant entry with no actor (shown as System)', () => {
    expect(auditEntrySchema.parse(grantEntry)).toEqual(grantEntry)
  })

  it('parses a Squad closure with its target snapshot and reason', () => {
    const entry = {
      ...grantEntry,
      action: 'squad_closed',
      actorId: 'admin-1',
      actorName: 'Ana',
      target: { type: 'squad', id: ENTRY_ID, name: 'Ranked', code: 'ABC123', game: 'Valorant' },
      reason: 'Offensive name',
      details: null,
    }

    expect(auditEntrySchema.parse(entry)).toEqual(entry)
  })

  it('parses a Catalog Import request, which has no target', () => {
    const entry = {
      ...grantEntry,
      action: 'catalog_import_requested',
      actorId: 'admin-1',
      actorName: 'Ana',
      target: null,
      details: { runId: ENTRY_ID },
    }

    expect(auditEntrySchema.parse(entry)).toEqual(entry)
  })

  it.each([
    ['an unknown action', { ...grantEntry, action: 'user_banned' }],
    ['a transport date that is not ISO', { ...grantEntry, createdAt: 'yesterday' }],
    [
      'an unknown role in the details',
      { ...grantEntry, details: { oldRole: 'x', newRole: 'admin' } },
    ],
  ])('rejects %s', (_, entry) => {
    expect(auditEntrySchema.safeParse(entry).success).toBe(false)
  })
})

describe('auditEntriesResponseSchema', () => {
  it('is the shared pagination response of audit entries', () => {
    const body = { items: [grantEntry], page: 1, pageSize: PAGE_SIZE, total: 1 }

    expect(auditEntriesResponseSchema.parse(body)).toEqual(body)
  })
})
