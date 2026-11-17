import { AppError } from './base.error'

/** The message id is already taken by another author or Squad, so the send cannot be a retry. */
export class ChatMessageIdConflictError extends AppError {
  readonly statusCode = 409
  readonly code = 'CHAT_MESSAGE_ID_CONFLICT'

  constructor(messageId: string) {
    super(`Chat message id "${messageId}" belongs to another message`)
  }
}

/** The member sent the most the Squad Chat allows in the window; they may send again after `retryAfterMs`. */
export class ChatRateLimitedError extends AppError {
  readonly statusCode = 429
  readonly code = 'CHAT_RATE_LIMITED'

  constructor(readonly retryAfterMs: number) {
    super('You are sending messages too fast. Try again shortly.')
  }
}
