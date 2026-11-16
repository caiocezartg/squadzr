import { CHAT } from '@squadzr/schemas'
import type { ChatMessageView } from '@domain/entities/chat-message.entity'
import type { IChatMessageRepository } from '@domain/repositories/chat-message.repository'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { Clock } from '@domain/services/clock.interface'
import { NotRoomMemberError } from '@application/errors'
import { resolveAccessibleRoom } from '../room/helpers/resolve-accessible-room'

export interface ListChatMessagesInput {
  readonly code: string
  readonly viewerId: string
}

export interface ListChatMessagesOutput {
  readonly roomCode: string
  /** Oldest first. */
  readonly items: ChatMessageView[]
  readonly hasMore: boolean
}

export interface IListChatMessagesUseCase {
  execute(input: ListChatMessagesInput): Promise<ListChatMessagesOutput>
}

export class ListChatMessagesUseCase implements IListChatMessagesUseCase {
  constructor(
    private readonly chatMessageRepository: IChatMessageRepository,
    private readonly roomRepository: IRoomRepository,
    private readonly roomMemberRepository: IRoomMemberRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: ListChatMessagesInput): Promise<ListChatMessagesOutput> {
    const { room, isMember } = await resolveAccessibleRoom(
      this.roomRepository,
      this.roomMemberRepository,
      this.clock,
      { code: input.code, viewerId: input.viewerId }
    )
    if (!isMember) {
      throw new NotRoomMemberError(input.viewerId, room.id)
    }

    // One row beyond the page tells whether older messages exist without a count.
    const newestFirst = await this.chatMessageRepository.listByRoom(room.id, {
      limit: CHAT.HISTORY_PAGE_SIZE + 1,
    })
    const hasMore = newestFirst.length > CHAT.HISTORY_PAGE_SIZE

    return {
      roomCode: room.code,
      items: newestFirst.slice(0, CHAT.HISTORY_PAGE_SIZE).reverse(),
      hasMore,
    }
  }
}
