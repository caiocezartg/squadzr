import { PROFILE_TOP_GAMES_LIMIT } from '@squadzr/schemas'
import type { PlayerStats } from '@domain/entities/squad-record.entity'
import type { User } from '@domain/entities/user.entity'
import type { ISquadRecordRepository } from '@domain/repositories/squad-record.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import { UserNotFoundError } from '@application/errors'

export interface GetPlayerProfileInput {
  readonly id: string
}

export interface GetPlayerProfileOutput {
  readonly user: User
  readonly stats: PlayerStats
}

export interface IGetPlayerProfileUseCase {
  execute(input: GetPlayerProfileInput): Promise<GetPlayerProfileOutput>
}

/** A person's public profile: who they are and what their completed Squads add up to. */
export class GetPlayerProfileUseCase implements IGetPlayerProfileUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly squadRecordRepository: ISquadRecordRepository
  ) {}

  async execute(input: GetPlayerProfileInput): Promise<GetPlayerProfileOutput> {
    const user = await this.userRepository.findById(input.id)
    if (!user) throw new UserNotFoundError(input.id)

    const stats = await this.squadRecordRepository.getPlayerStats(user.id, PROFILE_TOP_GAMES_LIMIT)
    return { user, stats }
  }
}
