import type { ChatMessage, NewChatMessage } from '@domain/entities/chat-message.entity'

export interface IChatMessageRepository {
  /** Stores a message and returns it with its id. */
  create(message: NewChatMessage): Promise<ChatMessage>
  /** The Squad's latest messages, at most `limit`, oldest first. */
  findRecentByRoomId(roomId: string, limit: number): Promise<ChatMessage[]>
}
