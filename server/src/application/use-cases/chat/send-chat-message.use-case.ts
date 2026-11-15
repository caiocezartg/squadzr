import type { ChatMessage } from '@domain/entities/chat-message.entity'
import type { IChatMessageRepository } from '@domain/repositories/chat-message.repository'
import type { Clock } from '@domain/services/clock.interface'
import { NotRoomMemberError, UnauthorizedError } from '@application/errors'
import type { IGetRoomByCodeUseCase } from '../room/get-room-by-code.use-case'

export interface SendChatMessageInput {
  readonly code: string
  /** The sender, from the session; a guest is refused before any lookup. */
  readonly userId: string | null
  /** Already trimmed and within the length limit: the message contract checks it. */
  readonly body: string
}

export interface SendChatMessageOutput {
  /** The Squad's code as stored, for the channel the message goes to. */
  readonly roomCode: string
  readonly message: ChatMessage
}

export interface ISendChatMessageUseCase {
  execute(input: SendChatMessageInput): Promise<SendChatMessageOutput>
}

/** A member writes in the chat of a Squad they hold a Membership in, while the Squad is still accessible. */
export class SendChatMessageUseCase implements ISendChatMessageUseCase {
  constructor(
    private readonly getRoom: IGetRoomByCodeUseCase,
    private readonly chatMessages: IChatMessageRepository,
    private readonly clock: Clock
  ) {}

  async execute({ code, userId, body }: SendChatMessageInput): Promise<SendChatMessageOutput> {
    if (!userId) throw new UnauthorizedError()
    const { room, isMember, players } = await this.getRoom.execute({ code, viewerId: userId })
    const author = players.find((player) => player.id === userId)
    if (!isMember || !author) throw new NotRoomMemberError(userId, room.id)

    const message = await this.chatMessages.create({
      roomId: room.id,
      authorId: author.id,
      authorName: author.name,
      authorImage: author.image,
      body,
      sentAt: this.clock.now(),
    })
    return { roomCode: room.code, message }
  }
}
