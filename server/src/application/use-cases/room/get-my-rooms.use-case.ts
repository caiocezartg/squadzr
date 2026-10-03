import type { Room } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { Clock } from '@domain/services/clock.interface'

export interface GetMyRoomsOutput {
  readonly hosted: Room[]
  readonly joined: Room[]
}

export interface IGetMyRoomsUseCase {
  execute(input: { userId: string }): Promise<GetMyRoomsOutput>
}

export class GetMyRoomsUseCase implements IGetMyRoomsUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: { userId: string }): Promise<GetMyRoomsOutput> {
    // Ready Rooms stay in My Rooms while their 60min retention has not passed;
    // expired Open Rooms and expired Ready Rooms are omitted.
    return this.roomRepository.findMyRooms(input.userId, this.clock.now())
  }
}
