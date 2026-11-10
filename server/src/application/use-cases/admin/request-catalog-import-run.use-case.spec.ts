import { beforeEach, describe, expect, it } from 'vitest'
import {
  CatalogImportManualLimitError,
  CatalogImportRunningError,
  CatalogImportUnavailableError,
} from '@application/errors'
import {
  createMockCatalogImportRun,
  createMockCatalogImportRunRepository,
  createMockClock,
  FIXED_NOW,
  type MockCatalogImportRunRepository,
  type MockClock,
} from '@test/mocks'
import { RequestCatalogImportRunUseCase } from './request-catalog-import-run.use-case'

const DAY = 24 * 60 * 60 * 1000
const ACTOR = { id: 'admin-1', name: 'Ada' }

let runs: MockCatalogImportRunRepository
let clock: MockClock

function build(importConfigured = true): RequestCatalogImportRunUseCase {
  return new RequestCatalogImportRunUseCase(runs, clock, importConfigured)
}

beforeEach(() => {
  runs = createMockCatalogImportRunRepository()
  clock = createMockClock()
})

describe('RequestCatalogImportRunUseCase', () => {
  it('queues a manual run for the admin and returns it', async () => {
    const queued = createMockCatalogImportRun({
      id: 'run-5',
      trigger: 'manual',
      status: 'requested',
    })
    runs.requestManual.mockResolvedValue({ status: 'requested', run: queued })

    const run = await build().execute({ actor: ACTOR })

    expect(run).toBe(queued)
    expect(runs.requestManual).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedBy: ACTOR,
        now: FIXED_NOW,
        requestedAfter: new Date(FIXED_NOW.getTime() - DAY),
      })
    )
  })

  it('builds the catalog_import_requested entry for the queued run, with the actor and no target', async () => {
    await build().execute({ actor: ACTOR })

    const { buildAuditEntry } = runs.requestManual.mock.calls[0]![0]
    expect(buildAuditEntry(createMockCatalogImportRun({ id: 'run-5' }), FIXED_NOW)).toEqual({
      actorId: 'admin-1',
      actorName: 'Ada',
      action: 'catalog_import_requested',
      target: null,
      reason: null,
      details: { runId: 'run-5' },
      createdAt: FIXED_NOW,
    })
  })

  it('is unavailable without IGDB credentials and touches nothing', async () => {
    await expect(build(false).execute({ actor: ACTOR })).rejects.toBeInstanceOf(
      CatalogImportUnavailableError
    )
    expect(runs.requestManual).not.toHaveBeenCalled()
  })

  it('refuses inside 24 hours of the last manual request and says when it is available again', async () => {
    const lastRequestedAt = new Date(FIXED_NOW.getTime() - 3_600_000)
    runs.requestManual.mockResolvedValue({ status: 'limit', lastRequestedAt })

    const error = await build()
      .execute({ actor: ACTOR })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(CatalogImportManualLimitError)
    expect((error as CatalogImportManualLimitError).availableAt).toEqual(
      new Date(lastRequestedAt.getTime() + DAY)
    )
  })

  it('refuses while another run holds the slot', async () => {
    runs.requestManual.mockResolvedValue({ status: 'slot_taken' })

    await expect(build().execute({ actor: ACTOR })).rejects.toBeInstanceOf(
      CatalogImportRunningError
    )
  })
})
