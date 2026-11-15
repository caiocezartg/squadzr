/**
 * One message of a Squad's chat. The author's name and picture are copied when it is sent, so the message
 * reads the same after the author renames or leaves.
 */
export interface ChatMessage {
  readonly id: string
  readonly roomId: string
  readonly authorId: string
  readonly authorName: string
  readonly authorImage: string | null
  readonly body: string
  readonly sentAt: Date
}

/** A message before it is stored: the store gives it its id. */
export type NewChatMessage = Omit<ChatMessage, 'id'>
