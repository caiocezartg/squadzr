import { describe, expect, it, vi } from 'vitest'
import { ADMIN_GAME_CHANGE_NAMES_LIMIT, PAGE_SIZE } from '@squadzr/schemas'
import type { IAdminGameRepository } from '@domain/repositories/admin-game.repository'
import type { IAdminSquadRepository } from '@domain/repositories/admin-squad.repository'
import { GameNotFoundError } from '@application/errors'
import {
  createMockCatalogImportRun,
  createMockCatalogImportRunRepository,
} from '@test/mocks/catalog-import-run.repository.mock'
import { GetAdminGameUseCase } from './get-admin-game.use-case'
import { GetAdminGamesSummaryUseCase } from './get-admin-games-summary.use-case'
import { ListAdminGamesUseCase } from './list-admin-games.use-case'

function createAdminGameRepository() {
  return {
    list: vi.fn<IAdminGameRepository['list']>().mockResolvedValue({ games: [], total: 0 }),
    findById: vi.fn<IAdminGameRepository['findById']>().mockResolvedValue(null),
    count: vi
      .fn<IAdminGameRepository['count']>()
      .mockResolvedValue({ listed: 3, delisted: 1, featured: 2 }),
    findChanges: vi.fn<IAdminGameRepository['findChanges']>().mockResolvedValue({
      entered: { total: 1, games: [{ id: 'g1', name: 'New' }] },
      left: { total: 0, games: [] },
    }),
  }
}

describe('ListAdminGamesUseCase', () => {
  it('defaults to every game by popularity and turns the page into an offset', async () => {
    const games = createAdminGameRepository()

    const output = await new ListAdminGamesUseCase(games).execute({ page: 3 })

    expect(games.list).toHaveBeenCalledWith({
      offset: 2 * PAGE_SIZE,
      limit: PAGE_SIZE,
      sort: 'popularity',
      status: 'all',
    })
    expect(output).toEqual({ games: [], page: 3, pageSize: PAGE_SIZE, total: 0 })
  })

  it('passes the search, status and sort through', async () => {
    const games = createAdminGameRepository()

    await new ListAdminGamesUseCase(games).execute({
      page: 1,
      q: 'cs2',
      status: 'delisted',
      sort: 'name',
    })

    expect(games.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'cs2', status: 'delisted', sort: 'name' })
    )
  })
})

describe('GetAdminGameUseCase', () => {
  it('throws GameNotFoundError for an unknown game without reading its Squads', async () => {
    const games = createAdminGameRepository()
    const squads = { listOpen: vi.fn() } as unknown as IAdminSquadRepository

    await expect(
      new GetAdminGameUseCase(games, squads).execute({ gameId: 'nope' })
    ).rejects.toThrow(GameNotFoundError)
    expect(squads.listOpen).not.toHaveBeenCalled()
  })
})

describe('GetAdminGamesSummaryUseCase', () => {
  it('has no last import before a run succeeded', async () => {
    const games = createAdminGameRepository()
    const runs = createMockCatalogImportRunRepository()

    const output = await new GetAdminGamesSummaryUseCase(games, runs).execute()

    expect(output).toEqual({ listed: 3, delisted: 1, featured: 2, lastImport: null })
    expect(games.findChanges).not.toHaveBeenCalled()
  })

  it('reads the changes inside the last succeeded run’s window, capped to five names', async () => {
    const games = createAdminGameRepository()
    const runs = createMockCatalogImportRunRepository()
    const startedAt = new Date('2026-11-05T04:00:00.000Z')
    const finishedAt = new Date('2026-11-05T04:00:04.000Z')
    runs.findLatestSucceeded.mockResolvedValue(
      createMockCatalogImportRun({ id: 'run-9', status: 'succeeded', startedAt, finishedAt })
    )

    const output = await new GetAdminGamesSummaryUseCase(games, runs).execute()

    expect(games.findChanges).toHaveBeenCalledWith(
      { from: startedAt, to: finishedAt },
      ADMIN_GAME_CHANGE_NAMES_LIMIT
    )
    expect(output.lastImport).toMatchObject({ runId: 'run-9', finishedAt })
  })
})
