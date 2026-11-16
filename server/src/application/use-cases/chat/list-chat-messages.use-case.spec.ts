import { beforeEach, describe, expect, it } from 'vitest'
import { CHAT } from '@squadzr/schemas'
import { NotRoomMemberError, RoomNotFoundError } from '@application/errors'
import {
  createMockChatMessageRepository,
  createMockChatMessageView,
  createMockClock,
  createMockRoom,
  createMockRoomMember,
  createMockRoomMemberRepository,
  createMockRoomRepository,
} from '@test/mocks'
import { ListChatMessagesUseCase } from './list-chat-messages.use-case'

const NOW = new Date('2026-01-01T00:00:00.000Z')

function messages(count: number) {
  // Newest first, as the repository returns them.
  return Array.from({ length: count }, (_, index) =>
    createMockChatMessageView({
      id: `00000000-0000-4000-8000-${String(count - index).padStart(12, '0')}`,
      body: `message ${count - index}`,
    })
  )
}

describe('ListChatMessagesUseCase', () => {
  let chats: ReturnType<typeof createMockChatMessageRepository>
  let rooms: ReturnType<typeof createMockRoomRepository>
  let members: ReturnType<typeof createMockRoomMemberRepository>
  let useCase: ListChatMessagesUseCase

  beforeEach(() => {
    chats = createMockChatMessageRepository()
    rooms = createMockRoomRepository()
    members = createMockRoomMemberRepository()
    useCase = new ListChatMessagesUseCase(chats, rooms, members, createMockClock(NOW))
    rooms.findByCode.mockResolvedValue(
      createMockRoom({ code: 'ABC123', lastActivityAt: NOW, createdAt: NOW })
    )
    members.findByRoomAndUser.mockResolvedValue(createMockRoomMember({ userId: 'viewer' }))
  })

  it('answers a missing Squad as not found', async () => {
    rooms.findByCode.mockResolvedValue(null)

    await expect(useCase.execute({ code: 'ABC123', viewerId: 'viewer' })).rejects.toBeInstanceOf(
      RoomNotFoundError
    )
    expect(chats.listByRoom).not.toHaveBeenCalled()
  })

  it('refuses a viewer who is not a member', async () => {
    members.findByRoomAndUser.mockResolvedValue(null)

    await expect(useCase.execute({ code: 'ABC123', viewerId: 'viewer' })).rejects.toBeInstanceOf(
      NotRoomMemberError
    )
    expect(chats.listByRoom).not.toHaveBeenCalled()
  })

  it('hides a Ready Squad from a non-member as not found', async () => {
    rooms.findByCode.mockResolvedValue(
      createMockRoom({ code: 'ABC123', readyAt: NOW, lastActivityAt: NOW, createdAt: NOW })
    )
    members.findByRoomAndUser.mockResolvedValue(null)

    await expect(useCase.execute({ code: 'ABC123', viewerId: 'viewer' })).rejects.toBeInstanceOf(
      RoomNotFoundError
    )
  })

  it('lets a member read a Ready Squad', async () => {
    rooms.findByCode.mockResolvedValue(
      createMockRoom({ code: 'ABC123', readyAt: NOW, lastActivityAt: NOW, createdAt: NOW })
    )

    const result = await useCase.execute({ code: 'ABC123', viewerId: 'viewer' })

    expect(result).toMatchObject({ roomCode: 'ABC123', items: [], hasMore: false })
  })

  it('returns the messages oldest first without hasMore on a short history', async () => {
    chats.listByRoom.mockResolvedValue(messages(3))

    const result = await useCase.execute({ code: 'ABC123', viewerId: 'viewer' })

    expect(result.items.map((message) => message.body)).toEqual([
      'message 1',
      'message 2',
      'message 3',
    ])
    expect(result.hasMore).toBe(false)
  })

  it('asks for one row beyond the page and reports hasMore without returning it', async () => {
    chats.listByRoom.mockResolvedValue(messages(CHAT.HISTORY_PAGE_SIZE + 1))

    const result = await useCase.execute({ code: 'ABC123', viewerId: 'viewer' })

    expect(chats.listByRoom).toHaveBeenCalledWith('room-uuid-1', {
      limit: CHAT.HISTORY_PAGE_SIZE + 1,
    })
    expect(result.items).toHaveLength(CHAT.HISTORY_PAGE_SIZE)
    expect(result.hasMore).toBe(true)
    // The extra row is the oldest one, so the page keeps the newest messages.
    expect(result.items.at(-1)?.body).toBe(`message ${CHAT.HISTORY_PAGE_SIZE + 1}`)
    expect(result.items[0]?.body).toBe('message 2')
  })

  it('reports no more history on exactly one page', async () => {
    chats.listByRoom.mockResolvedValue(messages(CHAT.HISTORY_PAGE_SIZE))

    const result = await useCase.execute({ code: 'ABC123', viewerId: 'viewer' })

    expect(result.items).toHaveLength(CHAT.HISTORY_PAGE_SIZE)
    expect(result.hasMore).toBe(false)
  })
})
