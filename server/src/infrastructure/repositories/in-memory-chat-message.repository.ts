import { randomUUID } from 'node:crypto'
import type { ChatMessage, NewChatMessage } from '@domain/entities/chat-message.entity'
import type { IChatMessageRepository } from '@domain/repositories/chat-message.repository'

/** Messages kept per Squad; older ones are dropped as new ones arrive. */
const MESSAGES_PER_ROOM = 200
/** Squads kept at once; the one written least recently is dropped first. */
const MAX_ROOMS = 1_000

/**
 * The chat preview's store: the process's memory, so a restart or a second instance loses the messages.
 * Writes keep a Squad last in the map's insertion order, which makes the first key the least recent one.
 */
export class InMemoryChatMessageRepository implements IChatMessageRepository {
  private readonly rooms = new Map<string, ChatMessage[]>()

  create(message: NewChatMessage): Promise<ChatMessage> {
    const stored: ChatMessage = { ...message, id: randomUUID() }
    const messages = this.rooms.get(message.roomId) ?? []
    this.rooms.delete(message.roomId)
    this.rooms.set(message.roomId, [...messages, stored].slice(-MESSAGES_PER_ROOM))
    if (this.rooms.size > MAX_ROOMS) {
      const oldest = this.rooms.keys().next().value
      if (oldest !== undefined) this.rooms.delete(oldest)
    }
    return Promise.resolve(stored)
  }

  findRecentByRoomId(roomId: string, limit: number): Promise<ChatMessage[]> {
    return Promise.resolve((this.rooms.get(roomId) ?? []).slice(-limit))
  }
}
