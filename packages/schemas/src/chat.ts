import { z } from 'zod'
import { isoDateTimeSchema } from './date'

// Squad Chat limits shared by the API and the client, so the composer refuses what the server would.
export const CHAT = {
  MESSAGE_MAX_LENGTH: 500,
  MESSAGE_MAX_LINE_BREAKS: 10,
  HISTORY_PAGE_SIZE: 50,
} as const

// U+200B to U+200D and U+FEFF render as nothing, so a body made only of them is empty. They are ignored
// only to decide that: the stored body keeps them, since U+200D joins the parts of compound emoji.
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g

function normalizeBody(raw: string): string {
  return raw.replace(/\r\n?/g, '\n').trim()
}

function hasVisibleText(body: string): boolean {
  return body.replace(ZERO_WIDTH, '').trim().length > 0
}

function countLineBreaks(body: string): number {
  return body.split('\n').length - 1
}

// The length limit applies to the stored body, so it always fits the column's check.
export const chatMessageBodySchema = z
  .string()
  .transform(normalizeBody)
  .pipe(
    z
      .string()
      .refine(hasVisibleText, { message: 'Message cannot be empty' })
      .max(CHAT.MESSAGE_MAX_LENGTH, `Message must be at most ${CHAT.MESSAGE_MAX_LENGTH} characters`)
      .refine((body) => countLineBreaks(body) <= CHAT.MESSAGE_MAX_LINE_BREAKS, {
        message: `Message can have at most ${CHAT.MESSAGE_MAX_LINE_BREAKS} line breaks`,
      })
  )

// The client generates the id, so a retry of one send is idempotent on the server.
export const sendChatMessageRequestSchema = z.object({
  id: z.uuid(),
  body: chatMessageBodySchema,
})

export type SendChatMessageRequest = z.infer<typeof sendChatMessageRequestSchema>

export const chatMessageSchema = z.object({
  id: z.uuid(),
  roomCode: z.string().length(6),
  body: z.string(),
  createdAt: isoDateTimeSchema,
  author: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  }),
})

export type ChatMessageDto = z.infer<typeof chatMessageSchema>

// Items come oldest first; `hasMore` says an older page exists.
export const chatHistoryResponseSchema = z.object({
  items: z.array(chatMessageSchema),
  hasMore: z.boolean(),
})

export type ChatHistoryResponse = z.infer<typeof chatHistoryResponseSchema>
