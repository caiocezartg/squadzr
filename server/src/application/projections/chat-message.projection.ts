import type { ChatMessageDto } from '@squadzr/schemas/ws'
import type { ChatMessage } from '@domain/entities/chat-message.entity'

/** A chat message as the Squad's members see it: no Squad id, the time as an ISO string. */
export function toChatMessageDto(message: ChatMessage): ChatMessageDto {
  return {
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    authorImage: message.authorImage,
    body: message.body,
    sentAt: message.sentAt.toISOString(),
  }
}
