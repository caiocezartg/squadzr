import { UnauthorizedError, NotRoomMemberError } from '@application/errors'
import type { IGetRoomByCodeUseCase } from './get-room-by-code.use-case'
import { buildRealtimeSnapshot, type RealtimeSnapshot } from './helpers/realtime-snapshot'

export interface SubscribeRealtimeSnapshotInput {
  readonly code: string
  /** Authenticated caller; a guest is refused before any lookup. */
  readonly userId: string | null
}

export type SubscribeRealtimeSnapshotOutput = RealtimeSnapshot & { userId: string }

export interface ISubscribeRealtimeSnapshotUseCase {
  execute(input: SubscribeRealtimeSnapshotInput): Promise<SubscribeRealtimeSnapshotOutput>
}

export class SubscribeRealtimeSnapshotUseCase implements ISubscribeRealtimeSnapshotUseCase {
  constructor(private readonly getRoom: IGetRoomByCodeUseCase) {}

  async execute(input: SubscribeRealtimeSnapshotInput): Promise<SubscribeRealtimeSnapshotOutput> {
    const { code, userId } = input
    if (!userId) throw new UnauthorizedError()
    const result = await this.getRoom.execute({ code, viewerId: userId })
    if (!result.isMember) throw new NotRoomMemberError(userId, result.room.id)
    return { ...buildRealtimeSnapshot(result.room, result.players), userId }
  }
}
