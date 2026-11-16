import { beforeEach, describe, expect, it } from 'vitest'
import { CHAT } from '@squadzr/schemas'
import {
  ChatMessageIdConflictError,
  ChatRateLimitedError,
  NotRoomMemberError,
  RoomNotFoundError,
  RoomReadyError,
} from '@application/errors'
import {
  createMockChatMessageRepository,
  createMockChatMessageView,
  createMockClock,
  createMockRoom,
  createMockRoomMember,
  createMockRoomMemberRepository,
  createMockRoomRepository,
} from '@test/mocks'
import { SendChatMessageUseCase } from './send-chat-message.use-case'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const ID = '0b7a6a3e-5f43-4f0b-8f4a-0d3f1c9a2b11'
const INPUT = { code: 'ABC123', authorId: 'author', id: ID, body: 'oi' }

describe('SendChatMessageUseCase', () => {
  let chats: ReturnType<typeof createMockChatMessageRepository>
  let rooms: ReturnType<typeof createMockRoomRepository>
  let members: ReturnType<typeof createMockRoomMemberRepository>
  let clock: ReturnType<typeof createMockClock>
  let useCase: SendChatMessageUseCase

  beforeEach(() => {
    chats = createMockChatMessageRepository()
    rooms = createMockRoomRepository()
    members = createMockRoomMemberRepository()
    clock = createMockClock(NOW)
    useCase = new SendChatMessageUseCase(chats, rooms, members, clock)
    rooms.findByCode.mockResolvedValue(
      createMockRoom({ code: 'ABC123', lastActivityAt: NOW, createdAt: NOW })
    )
    members.findByRoomAndUser.mockResolvedValue(createMockRoomMember({ userId: 'author' }))
  })

  it('answers a missing Squad as not found without writing', async () => {
    rooms.findByCode.mockResolvedValue(null)

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(RoomNotFoundError)
    expect(chats.createWithinRate).not.toHaveBeenCalled()
  })

  it('stores the message with the clock instant and returns it as created', async () => {
    const result = await useCase.execute(INPUT)

    expect(chats.createWithinRate).toHaveBeenCalledWith(
      {
        id: ID,
        roomId: 'room-uuid-1',
        authorId: 'author',
        body: 'oi',
        createdAt: NOW,
      },
      { limit: 5, windowStart: new Date(NOW.getTime() - 10_000) }
    )
    expect(result.created).toBe(true)
    expect(result.roomCode).toBe('ABC123')
    expect(result.message.id).toBe(ID)
  })

  it('returns the stored message of a retry, not created', async () => {
    const stored = createMockChatMessageView({ id: ID, body: 'first try' })
    chats.createWithinRate.mockResolvedValue({ kind: 'duplicate', message: stored })

    const result = await useCase.execute(INPUT)

    expect(result).toEqual({ roomCode: 'ABC123', message: stored, created: false })
  })

  it('refuses a send when the repository finds the author is no longer a member', async () => {
    chats.createWithinRate.mockResolvedValue({ kind: 'not_member' })

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(NotRoomMemberError)
  })

  it('refuses an id that belongs to another message', async () => {
    chats.createWithinRate.mockResolvedValue({ kind: 'id_conflict' })

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(ChatMessageIdConflictError)
  })

  describe('rate rule', () => {
    it('hands the repository the shared limit and a window that ends now', async () => {
      await useCase.execute(INPUT)

      const [, rule] = chats.createWithinRate.mock.calls[0]!
      expect(rule.limit).toBe(CHAT.RATE_LIMIT)
      expect(rule.limit).toBe(5)
      expect(rule.windowStart).toEqual(new Date(NOW.getTime() - CHAT.RATE_WINDOW_MS))
    })

    it('refuses with the time until the freeing message leaves the window', async () => {
      chats.createWithinRate.mockResolvedValue({
        kind: 'rate_limited',
        oldestInWindow: new Date(NOW.getTime() - 4_000),
      })

      const error = await useCase.execute(INPUT).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ChatRateLimitedError)
      expect(error).toMatchObject({
        statusCode: 429,
        code: 'CHAT_RATE_LIMITED',
        retryAfterMs: 6_000,
      })
    })

    it('waits at least 1ms when the oldest message sits on the window edge', async () => {
      chats.createWithinRate.mockResolvedValue({
        kind: 'rate_limited',
        oldestInWindow: new Date(NOW.getTime() - CHAT.RATE_WINDOW_MS),
      })

      await expect(useCase.execute(INPUT)).rejects.toMatchObject({ retryAfterMs: 1 })
    })

    it('waits the full window when the oldest message was just sent', async () => {
      chats.createWithinRate.mockResolvedValue({ kind: 'rate_limited', oldestInWindow: NOW })

      await expect(useCase.execute(INPUT)).rejects.toMatchObject({ retryAfterMs: 10_000 })
    })
  })

  it('refuses a send to a Ready Squad with a chat-specific message', async () => {
    chats.createWithinRate.mockResolvedValue({ kind: 'ready' })

    const error = await useCase.execute(INPUT).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RoomReadyError)
    expect(error).toMatchObject({ statusCode: 422, code: 'ROOM_READY' })
    expect((error as Error).message).toMatch(/chat/i)
  })
})
