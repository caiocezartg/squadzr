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

    // Everything the notification builder needs is read before the transaction;
    // the member list it receives comes from the locked transaction instead.
    const [game, members] = await Promise.all([
      this.gameRepository.findById(room.gameId),
      this.roomMemberRepository.findByRoomId(room.id),
    ])
    const users = await this.userRepository.findByIds([
      ...new Set([...members.map((member) => member.userId), input.userId]),
    ])

    const outcome = await this.roomMemberRepository.joinOpenRoom({
      roomId: room.id,
      userId: input.userId,
      now,
      buildReadyNotifications: (authoritativeMembers) =>
        buildRoomReadyNotifications({
          room,
          members: authoritativeMembers,
          users,
          gameName: game?.name ?? 'Unknown game',
        }),
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
