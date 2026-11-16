import type { ChatMessageDto } from '@squadzr/schemas'
import type { ChatMessageView } from '@domain/entities/chat-message.entity'

/** The wire shape of a Chat Message: the Squad is named by its code, the author by profile. */
export function toChatMessageDto(message: ChatMessageView, roomCode: string): ChatMessageDto {
  return {
    id: message.id,
    roomCode,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    author: {
      id: message.author.id,
      name: message.author.name,
      image: message.author.avatarUrl,
    },
  }
}
