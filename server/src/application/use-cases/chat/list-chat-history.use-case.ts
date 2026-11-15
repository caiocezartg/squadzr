import { CHAT_HISTORY_LIMIT } from '@squadzr/schemas/ws'
import type { ChatMessage } from '@domain/entities/chat-message.entity'
import type { IChatMessageRepository } from '@domain/repositories/chat-message.repository'

export interface ListChatHistoryInput {
  /** A Squad whose Membership the caller has already checked (the channel join does). */
  readonly roomId: string
}

export interface IListChatHistoryUseCase {
  execute(input: ListChatHistoryInput): Promise<ChatMessage[]>
}

/** The latest messages of a Squad's chat, oldest first, for a member joining its channel. */
export class ListChatHistoryUseCase implements IListChatHistoryUseCase {
  constructor(private readonly chatMessages: IChatMessageRepository) {}

  execute({ roomId }: ListChatHistoryInput): Promise<ChatMessage[]> {
    return this.chatMessages.findRecentByRoomId(roomId, CHAT_HISTORY_LIMIT)
  }
}
