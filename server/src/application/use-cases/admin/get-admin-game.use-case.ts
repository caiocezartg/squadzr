import { ADMIN_GAME_OPEN_SQUADS_LIMIT } from '@squadzr/schemas'
import type { AdminGame } from '@domain/entities/admin-game.entity'
import type { AdminSquad } from '@domain/entities/admin-squad.entity'
import type { IAdminGameRepository } from '@domain/repositories/admin-game.repository'
import type { IAdminSquadRepository } from '@domain/repositories/admin-squad.repository'
import { GameNotFoundError } from '@application/errors'

export interface GetAdminGameInput {
  readonly gameId: string
}

export interface GetAdminGameOutput {
  readonly game: AdminGame
  /** The newest Open Squads on the Game, at most {@link ADMIN_GAME_OPEN_SQUADS_LIMIT}. */
  readonly openSquads: AdminSquad[]
}

export interface IGetAdminGameUseCase {
  execute(input: GetAdminGameInput): Promise<GetAdminGameOutput>
}

/** One catalog Game, listed or not, with its usage and its Open Squads. An unknown id is 404. */
export class GetAdminGameUseCase implements IGetAdminGameUseCase {
  constructor(
    private readonly adminGameRepository: IAdminGameRepository,
    private readonly adminSquadRepository: IAdminSquadRepository
  ) {}

  async execute(input: GetAdminGameInput): Promise<GetAdminGameOutput> {
    const game = await this.adminGameRepository.findById(input.gameId)
    if (!game) throw new GameNotFoundError(input.gameId)

    const { squads } = await this.adminSquadRepository.listOpen({
      sort: 'newest',
      offset: 0,
      limit: ADMIN_GAME_OPEN_SQUADS_LIMIT,
      gameId: input.gameId,
    })

    return { game, openSquads: squads }
  }
}
