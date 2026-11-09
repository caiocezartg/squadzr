import { PAGE_SIZE, type AdminGameSort, type AdminGameStatus } from '@squadzr/schemas'
import type { AdminGame } from '@domain/entities/admin-game.entity'
import type { IAdminGameRepository } from '@domain/repositories/admin-game.repository'

export interface ListAdminGamesInput {
  /** 1-based; a page past the end gives no Games and the real total. */
  readonly page: number
  readonly q?: string | undefined
  /** Absent is `all`. */
  readonly status?: AdminGameStatus | undefined
  /** Absent is `popularity`. */
  readonly sort?: AdminGameSort | undefined
}

export interface ListAdminGamesOutput {
  readonly games: AdminGame[]
  readonly page: number
  readonly pageSize: typeof PAGE_SIZE
  readonly total: number
}

export interface IListAdminGamesUseCase {
  execute(input: ListAdminGamesInput): Promise<ListAdminGamesOutput>
}

/** The catalog's Games, listed or not, with their usage, in the shared page shape. */
export class ListAdminGamesUseCase implements IListAdminGamesUseCase {
  constructor(private readonly adminGameRepository: IAdminGameRepository) {}

  async execute(input: ListAdminGamesInput): Promise<ListAdminGamesOutput> {
    const { games, total } = await this.adminGameRepository.list({
      offset: (input.page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      sort: input.sort ?? 'popularity',
      status: input.status ?? 'all',
      ...(input.q === undefined ? {} : { search: input.q }),
    })

    return { games, page: input.page, pageSize: PAGE_SIZE, total }
  }
}
