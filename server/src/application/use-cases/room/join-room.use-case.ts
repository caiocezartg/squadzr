import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { UserNotification } from '@domain/entities/user-notification.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { Clock } from '@domain/services/clock.interface'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import {
  RoomNotFoundError,
  RoomFullError,
  RoomJoinLimitReachedError,
  RoomReadyError,
} from '@application/errors'
import { buildRoomReadyNotifications } from './room-ready-notifications'
import { ROOM } from '@config/constants'

export interface JoinRoomInput {
  readonly code: string
  readonly userId: string
}

export interface JoinRoomOutput {
  readonly room: Room
  readonly roomMember: RoomMember
  readonly memberCount: number
  /** True when this join produced the single transition to Ready. */
  readonly isRoomNowFull: boolean
  /** Persisted by the join transaction; pushed best-effort after commit. */
  readonly createdNotifications: readonly UserNotification[]
}

export interface IJoinRoomUseCase {
  execute(input: JoinRoomInput): Promise<JoinRoomOutput>
}

export class JoinRoomUseCase implements IJoinRoomUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly roomMemberRepository: IRoomMemberRepository,
    private readonly gameRepository: IGameRepository,
    private readonly userRepository: IUserRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: JoinRoomInput): Promise<JoinRoomOutput> {
    const now = this.clock.now()

    const room = await this.roomRepository.findByCode(input.code)
    if (!room || isRoomExpired(room, now, ROOM)) {
      throw new RoomNotFoundError(input.code)
    }

    // Idempotent for an existing member; no Membership change, no activity change.
    const existingMember = await this.roomMemberRepository.findByRoomAndUser(room.id, input.userId)
    if (existingMember) {
      const memberCount = await this.roomMemberRepository.countByRoomId(room.id)
      return {
        room,
        roomMember: existingMember,
        memberCount,
        isRoomNowFull: false,
        createdNotifications: [],
      }
    }

    // Enforce membership limit: max 5 valid rooms.
    const activeMembershipCount = await this.roomMemberRepository.countActiveByUserId(
      input.userId,
      now
    )
    if (activeMembershipCount >= ROOM.JOIN_LIMIT) {
      throw new RoomJoinLimitReachedError(ROOM.JOIN_LIMIT)
    }

    // The game name is stable and read up front; the roster's users are read
    // inside the join transaction, once the authoritative members are known.
    const game = await this.gameRepository.findById(room.gameId)
    const gameName = game?.name ?? 'Unknown game'

    const outcome = await this.roomMemberRepository.joinOpenRoom({
      roomId: room.id,
      userId: input.userId,
      buildReadyNotifications: async (authoritativeMembers) => {
        // Resolved inside the transaction, after the room lock: a member that
        // joined concurrently is part of the authoritative roster and must not
        // fall back to `Unknown` in the persisted payload.
        const users = await this.userRepository.findByIds(
          authoritativeMembers.map((member) => member.userId)
        )
        return buildRoomReadyNotifications({
          room,
          members: authoritativeMembers,
          users,
          gameName,
        })
      },
    })

    switch (outcome.status) {
      case 'joined':
        return {
          room,
          roomMember: outcome.member,
          memberCount: outcome.memberCount,
          isRoomNowFull: outcome.becameReady,
          createdNotifications: outcome.notifications,
        }
      case 'full':
        // Capacity is decided before readiness so the seat race loser keeps the
        // established ROOM_FULL answer, exactly as before readiness existed.
        throw new RoomFullError(room.id)
      case 'ready':
        throw new RoomReadyError(room.id, 'join')
      case 'expired':
      case 'not_found':
        throw new RoomNotFoundError(input.code)
    }
  }
}
