import type { RoomMember } from '@domain/entities/room-member.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import { RoomNotFoundError, RoomFullError, RoomJoinLimitReachedError } from '@application/errors'
import { ROOM } from '@config/constants'

export interface JoinRoomInput {
  readonly roomId: string
  readonly userId: string
}

export interface JoinRoomOutput {
  readonly roomMember: RoomMember
  readonly memberCount: number
  readonly isRoomNowFull: boolean
}

export interface IJoinRoomUseCase {
  execute(input: JoinRoomInput): Promise<JoinRoomOutput>
}

export class JoinRoomUseCase implements IJoinRoomUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly roomMemberRepository: IRoomMemberRepository
  ) {}

  async execute(input: JoinRoomInput): Promise<JoinRoomOutput> {
    const room = await this.roomRepository.findById(input.roomId)
    if (!room) {
      throw new RoomNotFoundError(input.roomId)
    }

    // Readiness (readyAt) is not checked here: CCC-36 owns the rule that a
    // Ready Room rejects every Membership change. Capacity is still enforced
    // atomically below, so a full room rejects the join with ROOM_FULL.
    // If user is already a member, return their existing membership (idempotent)
    const existingMember = await this.roomMemberRepository.findByRoomAndUser(
      input.roomId,
      input.userId
    )
    if (existingMember) {
      const memberCount = await this.roomMemberRepository.countByRoomId(input.roomId)
      return { roomMember: existingMember, memberCount, isRoomNowFull: false }
    }

    // Enforce membership limit: max 5 active rooms
    const activeMembershipCount = await this.roomMemberRepository.countActiveByUserId(input.userId)
    if (activeMembershipCount >= ROOM.JOIN_LIMIT) {
      throw new RoomJoinLimitReachedError(ROOM.JOIN_LIMIT)
    }

    // Atomically check capacity and insert — prevents concurrent overfill via SELECT FOR UPDATE
    const { member: roomMember, memberCount: newMemberCount } =
      await this.roomMemberRepository.createIfCapacityAvailable(
        { roomId: input.roomId, userId: input.userId },
        room.maxPlayers
      )

    if (!roomMember) {
      throw new RoomFullError(input.roomId)
    }

    const isRoomNowFull = newMemberCount >= room.maxPlayers

    if (isRoomNowFull) {
      await this.roomRepository.update(input.roomId, {
        readyAt: new Date(),
      })
    }

    return { roomMember, memberCount: newMemberCount, isRoomNowFull }
  }
}
