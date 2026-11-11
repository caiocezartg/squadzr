import { PAGE_SIZE, type AdminSquadSort, type Platform, type RoomLanguage } from '@squadzr/schemas'
import type { AdminSquad } from '@domain/entities/admin-squad.entity'
import type { IAdminSquadRepository } from '@domain/repositories/admin-squad.repository'

export interface ListAdminSquadsInput {
  /** 1-based; a page past the end gives no Squads and the real total. */
  readonly page: number
  readonly q?: string | undefined
  readonly gameId?: string | undefined
  readonly platform?: Platform | undefined
  readonly language?: RoomLanguage | undefined
  /** Absent is `newest`. */
  readonly sort?: AdminSquadSort | undefined
}

export interface ListAdminSquadsOutput {
  readonly squads: AdminSquad[]
  readonly page: number
  readonly pageSize: typeof PAGE_SIZE
  readonly total: number
}

export interface IListAdminSquadsUseCase {
  execute(input: ListAdminSquadsInput): Promise<ListAdminSquadsOutput>
}

export class ListAdminSquadsUseCase implements IListAdminSquadsUseCase {
  constructor(private readonly adminSquadRepository: IAdminSquadRepository) {}

  async execute(input: ListAdminSquadsInput): Promise<ListAdminSquadsOutput> {
    const { squads, total } = await this.adminSquadRepository.listOpen({
      offset: (input.page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      sort: input.sort ?? 'newest',
      ...(input.q === undefined ? {} : { search: input.q }),
      ...(input.gameId === undefined ? {} : { gameId: input.gameId }),
      ...(input.platform === undefined ? {} : { platform: input.platform }),
      ...(input.language === undefined ? {} : { language: input.language }),
    })

    return { squads, page: input.page, pageSize: PAGE_SIZE, total }
  }
}
