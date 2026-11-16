import type { ChatMessage, ChatMessageView } from '@domain/entities/chat-message.entity'

export interface ListChatMessagesOptions {
  /** Rows to return. The use case asks for one more than a page to learn whether older ones exist. */
  readonly limit: number
}

export type CreateChatMessageOutcome =
  | { readonly kind: 'created'; readonly message: ChatMessageView }
  /** The same id by the same author in the same Squad was already stored: a retry. */
  | { readonly kind: 'duplicate'; readonly message: ChatMessageView }
  /** The author holds no Membership in the Squad, or the Squad no longer exists. */
  | { readonly kind: 'not_member' }
  /** The id is taken by another author or Squad. */
  | { readonly kind: 'id_conflict' }

export interface IChatMessageRepository {
  /** The latest messages of the Squad, newest first. */
  listByRoom(roomId: string, options: ListChatMessagesOptions): Promise<ChatMessageView[]>
  /**
   * Atomic send: locks the room row, re-checks the author's Membership under the lock
   * and inserts the message, so a send cannot race a leave. The id is the idempotency
   * key: a retry answers `duplicate` with the stored message. The creation instant is
   * the caller's, never a database default.
   */
  createWithinRate(input: ChatMessage): Promise<CreateChatMessageOutcome>
}
