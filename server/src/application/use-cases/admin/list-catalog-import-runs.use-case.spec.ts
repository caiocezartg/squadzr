import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMockCatalogImportRun,
  createMockCatalogImportRunRepository,
  createMockClock,
  FIXED_NOW,
  type MockCatalogImportRunRepository,
} from '@test/mocks'
import { ListCatalogImportRunsUseCase } from './list-catalog-import-runs.use-case'

const DAY = 24 * 60 * 60 * 1000

let runs: MockCatalogImportRunRepository
let useCase: ListCatalogImportRunsUseCase

beforeEach(() => {
  runs = createMockCatalogImportRunRepository()
  useCase = new ListCatalogImportRunsUseCase(runs, createMockClock())
})

describe('ListCatalogImportRunsUseCase', () => {
  it('pages the runs and is available with no active run before any manual request', async () => {
    const run = createMockCatalogImportRun()
    runs.list.mockResolvedValue({ runs: [run], total: 21 })

    const output = await useCase.execute({ page: 2 })

    expect(runs.list).toHaveBeenCalledWith(20, 20)
    expect(output).toEqual({
      runs: [run],
      page: 2,
      pageSize: 20,
      total: 21,
      manualRun: { available: true },
      activeRun: null,
    })
  })

  it('names the instant a manual run is available again, 24 hours after the last request', async () => {
    const requestedAt = new Date(FIXED_NOW.getTime() - DAY + 60_000)
    runs.findLatestManualRequestedAt.mockResolvedValue(requestedAt)

    const output = await useCase.execute({ page: 1 })

    expect(output.manualRun).toEqual({
      available: false,
      availableAt: new Date(requestedAt.getTime() + DAY),
    })
  })

  it('is available again at exactly 24 hours', async () => {
    runs.findLatestManualRequestedAt.mockResolvedValue(new Date(FIXED_NOW.getTime() - DAY))

    const output = await useCase.execute({ page: 1 })

    expect(output.manualRun).toEqual({ available: true })
  })

  it('carries the run holding the slot whatever the page', async () => {
    const active = createMockCatalogImportRun({ id: 'run-9', status: 'requested' })
    runs.findActive.mockResolvedValue(active)

    const output = await useCase.execute({ page: 5 })

    expect(output.activeRun).toBe(active)
  })
})
