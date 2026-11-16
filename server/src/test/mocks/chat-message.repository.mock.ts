import { vi, type Mock } from 'vitest'
import type { ChatMessage, ChatMessageView } from '@domain/entities/chat-message.entity'
import type {
  CreateChatMessageOutcome,
  IChatMessageRepository,
  ListChatMessagesOptions,
} from '@domain/repositories/chat-message.repository'

export function createMockChatMessageView(overrides?: Partial<ChatMessageView>): ChatMessageView {
  return {
    id: '0b7a6a3e-5f43-4f0b-8f4a-0d3f1c9a2b11',
    roomId: 'room-uuid-1',
    authorId: 'user-uuid-1',
    body: 'hello',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    author: { id: 'user-uuid-1', name: 'Ana', avatarUrl: null },
    ...overrides,
  }
}

export type MockChatMessageRepository = {
  [K in keyof IChatMessageRepository]: Mock<IChatMessageRepository[K]>
}

export function createMockChatMessageRepository(): MockChatMessageRepository {
  return {
    listByRoom: vi
      .fn<(roomId: string, options: ListChatMessagesOptions) => Promise<ChatMessageView[]>>()
      .mockResolvedValue([]),
    createWithinRate: vi
      .fn<(input: ChatMessage) => Promise<CreateChatMessageOutcome>>()
      .mockImplementation((input) =>
        Promise.resolve({ kind: 'created', message: createMockChatMessageView({ ...input }) })
      ),
  }
}
