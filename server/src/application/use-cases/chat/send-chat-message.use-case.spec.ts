import { describe, expect, it, vi } from 'vitest'
import { createMockRoom } from '@test/mocks'
import { FakeClock } from '@test/harness/clock'
import { InMemoryChatMessageRepository } from '@infrastructure/repositories/in-memory-chat-message.repository'
import type { GetRoomByCodeOutput, IGetRoomByCodeUseCase } from '../room/get-room-by-code.use-case'
import { SendChatMessageUseCase } from './send-chat-message.use-case'

const NOW = new Date('2026-11-15T12:00:00.000Z')
const room = createMockRoom({ code: 'ABC123' })
const author = { id: 'user-1', name: 'Caio', image: 'https://cdn.test/caio.png', isHost: true }

function setup(read: Partial<GetRoomByCodeOutput> = {}) {
  const getRoom: IGetRoomByCodeUseCase = {
    execute: vi.fn(() => Promise.resolve({ room, isMember: true, players: [author], ...read })),
  }
  const chatMessages = new InMemoryChatMessageRepository()
  const useCase = new SendChatMessageUseCase(getRoom, chatMessages, new FakeClock(NOW))
  return { useCase, getRoom, chatMessages }
}

describe('SendChatMessageUseCase', () => {
  it('stores the message with the author as they are now and the time it was sent', async () => {
    const { useCase, chatMessages } = setup()

    const sent = await useCase.execute({ code: 'abc123', userId: author.id, body: 'bora?' })

    expect(sent).toEqual({
      roomCode: 'ABC123',
      message: {
        id: expect.any(String),
        roomId: room.id,
        authorId: author.id,
        authorName: 'Caio',
        authorImage: author.image,
        body: 'bora?',
        sentAt: NOW,
      },
    })
    expect(await chatMessages.findRecentByRoomId(room.id, 10)).toEqual([sent.message])
  })

  it('refuses a guest before reading the Squad', async () => {
    const { useCase, getRoom } = setup()

    await expect(
      useCase.execute({ code: 'ABC123', userId: null, body: 'hi' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(getRoom.execute).not.toHaveBeenCalled()
  })

  it('refuses someone outside the Squad and stores nothing', async () => {
    const { useCase, chatMessages } = setup({ isMember: false, players: [] })

    await expect(
      useCase.execute({ code: 'ABC123', userId: 'outsider', body: 'hi' })
    ).rejects.toMatchObject({ code: 'NOT_ROOM_MEMBER' })
    expect(await chatMessages.findRecentByRoomId(room.id, 10)).toEqual([])
  })
})
