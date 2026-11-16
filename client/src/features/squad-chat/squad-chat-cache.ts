import type { InfiniteData } from '@tanstack/react-query'
import type { ChatHistoryResponse, ChatMessageDto } from '@squadzr/schemas'

/**
 * The history of a Squad Chat, newest page first. Each page lists its messages oldest first, so reading
 * the pages in reverse and each one in order gives the whole conversation oldest first.
 */
export type ChatHistoryData = InfiniteData<ChatHistoryResponse, string | undefined>

/** The query key of a Squad's chat. The code is uppercased, as the contract carries it. */
export function squadChatQueryKey(squadCode: string) {
  return ['squad-chat', squadCode.toUpperCase()] as const
}

/** The server's order: send time, then id for messages stored in the same millisecond. */
function compareMessages(a: ChatMessageDto, b: ChatMessageDto): number {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt)
  if (byTime !== 0) return byTime
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Every message of the history, oldest first, once each. */
export function messagesOf(data: ChatHistoryData): ChatMessageDto[] {
  const seen = new Set<string>()
  const messages: ChatMessageDto[] = []
  for (const page of [...data.pages].reverse()) {
    for (const message of page.items) {
      if (seen.has(message.id)) continue
      seen.add(message.id)
      messages.push(message)
    }
  }
  return messages
}

function withoutMessage(items: readonly ChatMessageDto[], id: string): ChatMessageDto[] {
  return items.filter((item) => item.id !== id)
}

/** Drops a message, wherever the history holds it. */
export function removeMessage(data: ChatHistoryData, id: string): ChatHistoryData {
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: withoutMessage(page.items, id) })),
  }
}

/**
 * Puts a message in the latest page at its place in the server's order. A message the history already holds
 * under that id is replaced, so the viewer's own message, shown before the server answered, and the server's
 * message of the same id (the echo and the response) end up as one.
 */
export function upsertMessage(data: ChatHistoryData, message: ChatMessageDto): ChatHistoryData {
  const [latest, ...older] = removeMessage(data, message.id).pages
  if (!latest) return data

  const items = [...latest.items, message].sort(compareMessages)
  return { ...data, pages: [{ ...latest, items }, ...older] }
}
