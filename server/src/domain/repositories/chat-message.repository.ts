import type { ChatMessage, ChatMessageView } from '@domain/entities/chat-message.entity'

export interface ListChatMessagesOptions {
  /**
   * Keyset cursor: only messages older than this one, resolved inside the same Squad.
   * An id that is unknown or belongs to another Squad yields no rows.
   */
  readonly beforeId?: string
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
  /** The Squad is Ready: its chat is read-only. */
  | { readonly kind: 'ready' }
  /**
   * The author already sent `limit` messages in the window.
   * `oldestInWindow` is the message whose leaving the window frees a slot.
   */
  | { readonly kind: 'rate_limited'; readonly oldestInWindow: Date }

/** The anti-spam rule of a send, decided by the use case and enforced by the repository. */
export interface ChatRateRule {
  /** Most messages an author may have in the window. */
  readonly limit: number
  /** Only messages created after this instant count. */
  readonly windowStart: Date
}

export interface IChatMessageRepository {
  /** The latest messages of the Squad, or the ones before the cursor, newest first. */
  listByRoom(roomId: string, options: ListChatMessagesOptions): Promise<ChatMessageView[]>
  /**
   * Atomic send: locks the room row, then re-checks the author's Membership, the Squad's
   * Ready state and the rate rule under the lock before inserting, so a send cannot race a
   * leave, the join that makes the Squad Ready, or another send of the same author. The id
   * is the idempotency key: a retry answers `duplicate` with the stored message, before the
   * Ready and rate checks. The creation instant is the caller's, never a database default.
   */
  createWithinRate(input: ChatMessage, rule: ChatRateRule): Promise<CreateChatMessageOutcome>
}
