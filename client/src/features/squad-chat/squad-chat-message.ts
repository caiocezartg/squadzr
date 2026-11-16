import type { ChatMessageDto } from '@squadzr/schemas'

/**
 * A Chat Message as the window draws it. A pending message is the viewer's own send that the server has not
 * confirmed yet, drawn under the id the client generated for it.
 */
export interface SquadChatMessage {
  readonly id: string
  readonly body: string
  /** ISO instant: the server's for a stored message, the viewer's own clock for a pending one. */
  readonly createdAt: string
  readonly author: ChatMessageDto['author']
  readonly pending: boolean
}

export function toSquadChatMessage(message: ChatMessageDto): SquadChatMessage {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    author: message.author,
    pending: false,
  }
}
