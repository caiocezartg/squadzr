import { describe, expect, it } from 'vitest'
import type { NewChatMessage } from '@domain/entities/chat-message.entity'
import { InMemoryChatMessageRepository } from './in-memory-chat-message.repository'

function message(roomId: string, body: string): NewChatMessage {
  return {
    roomId,
    authorId: 'user-1',
    authorName: 'Caio',
    authorImage: null,
    body,
    sentAt: new Date('2026-11-15T12:00:00.000Z'),
  }
}

describe('InMemoryChatMessageRepository', () => {
  it('gives each message its own id and reads a Squad latest messages, oldest first', async () => {
    const repository = new InMemoryChatMessageRepository()
    const first = await repository.create(message('room-a', 'one'))
    const second = await repository.create(message('room-a', 'two'))
    await repository.create(message('room-b', 'elsewhere'))
    await repository.create(message('room-a', 'three'))

    expect(first.id).not.toBe(second.id)
    const recent = await repository.findRecentByRoomId('room-a', 2)
    expect(recent.map((entry) => entry.body)).toEqual(['two', 'three'])
  })

  it('keeps at most 200 messages per Squad', async () => {
    const repository = new InMemoryChatMessageRepository()
    for (let index = 0; index < 205; index += 1) {
      await repository.create(message('room-a', `message ${index}`))
    }

    const kept = await repository.findRecentByRoomId('room-a', 1_000)
    expect(kept).toHaveLength(200)
    expect(kept[0]?.body).toBe('message 5')
  })

  it('reads nothing for a Squad without messages', async () => {
    expect(await new InMemoryChatMessageRepository().findRecentByRoomId('room-a', 10)).toEqual([])
  })
})
