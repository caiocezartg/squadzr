import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type {
  ChatHistoryQuery,
  roomCodeParamSchema,
  sendChatMessageRequestSchema,
} from '@squadzr/schemas'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import type { IListChatMessagesUseCase } from '@application/use-cases/chat/list-chat-messages.use-case'
import type { ISendChatMessageUseCase } from '@application/use-cases/chat/send-chat-message.use-case'
import { toChatMessageDto } from '@application/projections'

type RoomCodeParams = z.infer<typeof roomCodeParamSchema>
type SendChatMessageBody = z.infer<typeof sendChatMessageRequestSchema>

export interface ChatControllerDeps {
  readonly listChatMessagesUseCase: IListChatMessagesUseCase
  readonly sendChatMessageUseCase: ISendChatMessageUseCase
  readonly broadcaster: IRoomBroadcaster
}

export class ChatController {
  constructor(private readonly deps: ChatControllerDeps) {}

  async list(
    request: FastifyRequest<{ Params: RoomCodeParams; Querystring: ChatHistoryQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.listChatMessagesUseCase.execute({
      code: request.params.code,
      viewerId: request.userId,
      before: request.query.before,
    })

    await reply.send({
      items: result.items.map((message) => toChatMessageDto(message, result.roomCode)),
      hasMore: result.hasMore,
    })
  }

  async send(
    request: FastifyRequest<{ Params: RoomCodeParams; Body: SendChatMessageBody }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.sendChatMessageUseCase.execute({
      code: request.params.code,
      authorId: request.userId,
      id: request.body.id,
      body: request.body.body,
    })

    // After commit, and only for a message this call stored: a retry was already delivered.
    // Best effort: the stored message is the source of truth and history converges the rest.
    if (result.created) this.deps.broadcaster.broadcastChatMessage(result.roomCode, result.message)

    // A retry of a stored send answers 200: nothing new was created.
    await reply
      .code(result.created ? 201 : 200)
      .send(toChatMessageDto(result.message, result.roomCode))
  }
}
