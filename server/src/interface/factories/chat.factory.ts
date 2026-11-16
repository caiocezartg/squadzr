import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import { DrizzleChatMessageRepository } from '@infrastructure/repositories/drizzle-chat-message.repository'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleRoomMemberRepository } from '@infrastructure/repositories/drizzle-room-member.repository'
import { ListChatMessagesUseCase } from '@application/use-cases/chat/list-chat-messages.use-case'
import { SendChatMessageUseCase } from '@application/use-cases/chat/send-chat-message.use-case'
import { ChatController } from '@interface/controllers/chat.controller'

export function createChatController(db: Database, broadcaster: IRoomBroadcaster, clock: Clock) {
  const chatMessageRepository = new DrizzleChatMessageRepository(db)
  const roomRepository = new DrizzleRoomRepository(db, clock)
  const roomMemberRepository = new DrizzleRoomMemberRepository(db, clock)

  const listChatMessagesUseCase = new ListChatMessagesUseCase(
    chatMessageRepository,
    roomRepository,
    roomMemberRepository,
    clock
  )
  const sendChatMessageUseCase = new SendChatMessageUseCase(
    chatMessageRepository,
    roomRepository,
    roomMemberRepository,
    clock
  )

  return new ChatController({ listChatMessagesUseCase, sendChatMessageUseCase, broadcaster })
}
