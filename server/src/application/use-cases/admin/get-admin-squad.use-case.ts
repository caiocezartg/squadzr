import type { AdminSquadDetail } from '@domain/entities/admin-squad.entity'
import type { IAdminSquadRepository } from '@domain/repositories/admin-squad.repository'
import { RoomNotFoundError } from '@application/errors'

export interface GetAdminSquadInput {
  readonly roomId: string
}

export interface IGetAdminSquadUseCase {
  execute(input: GetAdminSquadInput): Promise<AdminSquadDetail>
}

/** The side panel's Squad. Only an Open Squad has one: unknown, Ready and expired Squads are 404. */
export class GetAdminSquadUseCase implements IGetAdminSquadUseCase {
  constructor(private readonly adminSquadRepository: IAdminSquadRepository) {}

  async execute(input: GetAdminSquadInput): Promise<AdminSquadDetail> {
    const squad = await this.adminSquadRepository.findOpenById(input.roomId)
    if (!squad) throw new RoomNotFoundError(input.roomId)
    return squad
  }
}
