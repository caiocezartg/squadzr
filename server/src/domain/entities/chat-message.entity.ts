/** A message a member sent in the chat of their Squad (a Chat Message). */
export interface ChatMessage {
  readonly id: string
  readonly roomId: string
  readonly authorId: string
  readonly body: string
  readonly createdAt: Date
}

export interface ChatMessageAuthor {
  readonly id: string
  readonly name: string
  readonly avatarUrl: string | null
}

/** A Chat Message with its author as they are now: a renamed member shows their current name. */
export interface ChatMessageView extends ChatMessage {
  readonly author: ChatMessageAuthor
}
