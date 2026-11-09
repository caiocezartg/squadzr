import { describe, expect, it } from 'vitest'
import {
  CATALOG_IMPORT_RUN_STATUSES,
  catalogImportRunSchema,
  catalogImportRunsResponseSchema,
} from './index'

const succeeded = {
  id: 'run-1',
  trigger: 'scheduled',
  requestedBy: null,
  status: 'succeeded',
  requestedAt: '2026-11-05T04:00:00.000Z',
  startedAt: '2026-11-05T04:00:00.000Z',
  finishedAt: '2026-11-05T04:00:04.000Z',
  summary: {
    created: 4,
    updated: 10,
    delisted: 1,
    relisted: 2,
    received: 16,
    dropped: 1,
    invalid: 0,
  },
  listedGames: 1675,
  errorMessage: null,
}

describe('catalog import run', () => {
  it('carries a succeeded run with its summary and the Listed Games count', () => {
    expect(catalogImportRunSchema.parse(succeeded)).toEqual(succeeded)
  })

  it('carries a queued manual run with its admin and nothing else', () => {
    const queued = {
      ...succeeded,
      trigger: 'manual',
      requestedBy: { id: 'admin-1', name: 'Marina' },
      status: 'requested',
      startedAt: null,
      finishedAt: null,
      summary: null,
      listedGames: null,
    }

    expect(catalogImportRunSchema.parse(queued)).toEqual(queued)
  })

  it('carries a stopped run with its error message and no summary', () => {
    const stopped = {
      ...succeeded,
      status: 'safety_stop',
      summary: null,
      errorMessage: 'Catalog Import received 3 candidates',
    }

    expect(catalogImportRunSchema.parse(stopped)).toEqual(stopped)
  })

  it('keeps the name of an admin whose account is gone', () => {
    const orphan = { ...succeeded, trigger: 'manual', requestedBy: { id: null, name: 'Marina' } }

    expect(catalogImportRunSchema.safeParse(orphan).success).toBe(true)
  })

  it.each(CATALOG_IMPORT_RUN_STATUSES)('accepts the status %s', (status) => {
    expect(catalogImportRunSchema.safeParse({ ...succeeded, status }).success).toBe(true)
  })

  it('rejects an unknown status or trigger and a negative count', () => {
    expect(catalogImportRunSchema.safeParse({ ...succeeded, status: 'done' }).success).toBe(false)
    expect(catalogImportRunSchema.safeParse({ ...succeeded, trigger: 'api' }).success).toBe(false)
    expect(catalogImportRunSchema.safeParse({ ...succeeded, listedGames: -1 }).success).toBe(false)
  })
})

describe('catalog import runs response', () => {
  it('is a shared page of runs', () => {
    const page = { items: [succeeded], page: 1, pageSize: 20, total: 1 }

    expect(catalogImportRunsResponseSchema.parse(page)).toEqual(page)
  })
})
