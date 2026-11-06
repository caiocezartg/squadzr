import { ADMIN_USER_LATEST_COMPLETED_LIMIT } from '@squadzr/schemas'
import { ROOM } from '@config/constants'
import type {
  AdminUser,
  AdminUserCompletedSquad,
  AdminUserOpenSquad,
} from '@domain/entities/admin-user.entity'
import type { IAdminUserRepository } from '@domain/repositories/admin-user.repository'
import type { ISquadRecordRepository } from '@domain/repositories/squad-record.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { OnlinePresence } from '@domain/services/online-presence.interface'
import { UserNotFoundError } from '@application/errors'

export interface GetAdminUserInput {
  readonly id: string
}

export interface LimitUsage {
  readonly used: number
  readonly limit: number
}

export interface GetAdminUserOutput {
  readonly user: AdminUser
  readonly online: boolean
  /** Open Squads held (Memberships, the hosted ones included) and hosted, against the Squad Limits. */
  readonly squadLimits: { readonly held: LimitUsage; readonly hosted: LimitUsage }
  readonly openSquads: AdminUserOpenSquad[]
  readonly completedSquads: number
  readonly gamesPlayed: number
  readonly latestCompleted: AdminUserCompletedSquad[]
}

export interface IGetAdminUserUseCase {
  execute(input: GetAdminUserInput): Promise<GetAdminUserOutput>
}

/**
 * The admin's user page: who the person is, whether they are online, how much of the Squad Limits
 * they use, the Open Squads they are in and what they completed. Both limits are counted over the
 * same valid Open Squads the person is listed in, so the numbers and the list always agree.
 */
export class GetAdminUserUseCase implements IGetAdminUserUseCase {
  constructor(
    private readonly adminUserRepository: IAdminUserRepository,
    private readonly squadRecordRepository: ISquadRecordRepository,
    private readonly onlinePresence: OnlinePresence,
    private readonly clock: Clock
  ) {}

  async execute(input: GetAdminUserInput): Promise<GetAdminUserOutput> {
    const user = await this.adminUserRepository.findById(input.id)
    if (!user) throw new UserNotFoundError(input.id)

    const [openSquads, stats, latestCompleted] = await Promise.all([
      this.adminUserRepository.findOpenSquads(user.id, this.clock.now()),
      this.squadRecordRepository.getPlayerStats(user.id, 0),
      this.adminUserRepository.findLatestCompleted(user.id, ADMIN_USER_LATEST_COMPLETED_LIMIT),
    ])

    return {
      user,
      online: this.onlinePresence.isUserOnline(user.id),
      squadLimits: {
        held: { used: openSquads.length, limit: ROOM.JOIN_LIMIT },
        hosted: {
          used: openSquads.filter((squad) => squad.isHost).length,
          limit: ROOM.CREATE_LIMIT,
        },
      },
      openSquads,
      completedSquads: stats.completedSquads,
      gamesPlayed: stats.gamesPlayed,
      latestCompleted,
    }
  }
}
