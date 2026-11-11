import { vi, type Mock } from 'vitest'
import type { CatalogImportRun } from '@domain/entities/catalog-import-run.entity'
import type { ICatalogImportRunRepository } from '@domain/repositories/catalog-import-run.repository'

export function createMockCatalogImportRun(
  overrides: Partial<CatalogImportRun> = {}
): CatalogImportRun {
  return {
    id: 'run-1',
    trigger: 'scheduled',
    requestedBy: null,
    status: 'running',
    requestedAt: new Date('2026-01-01T00:00:00.000Z'),
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    finishedAt: null,
    heartbeatAt: new Date('2026-01-01T00:00:00.000Z'),
    summary: null,
    listedGames: null,
    errorMessage: null,
    ...overrides,
  }
}

export type MockCatalogImportRunRepository = {
  [K in keyof ICatalogImportRunRepository]: Mock<ICatalogImportRunRepository[K]>
}

export function createMockCatalogImportRunRepository(): MockCatalogImportRunRepository {
  return {
    interruptStale: vi.fn<ICatalogImportRunRepository['interruptStale']>().mockResolvedValue(0),
    claim: vi
      .fn<ICatalogImportRunRepository['claim']>()
      .mockImplementation(() => Promise.resolve(createMockCatalogImportRun())),
    requestManual: vi.fn<ICatalogImportRunRepository['requestManual']>().mockImplementation(() =>
      Promise.resolve({
        status: 'requested',
        run: createMockCatalogImportRun({
          trigger: 'manual',
          status: 'requested',
          startedAt: null,
        }),
      })
    ),
    claimRequested: vi.fn<ICatalogImportRunRepository['claimRequested']>().mockResolvedValue(null),
    heartbeat: vi.fn<ICatalogImportRunRepository['heartbeat']>().mockResolvedValue(undefined),
    finish: vi.fn<ICatalogImportRunRepository['finish']>().mockResolvedValue(undefined),
    list: vi.fn<ICatalogImportRunRepository['list']>().mockResolvedValue({ runs: [], total: 0 }),
    findActive: vi.fn<ICatalogImportRunRepository['findActive']>().mockResolvedValue(null),
    findLatestManualRequestedAt: vi
      .fn<ICatalogImportRunRepository['findLatestManualRequestedAt']>()
      .mockResolvedValue(null),
    findLatest: vi.fn<ICatalogImportRunRepository['findLatest']>().mockResolvedValue(null),
    findLatestFinished: vi
      .fn<ICatalogImportRunRepository['findLatestFinished']>()
      .mockResolvedValue(null),
  }
}
