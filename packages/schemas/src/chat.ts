import { z } from 'zod'
import { containsLink } from './chat-link'
import { isoDateTimeSchema } from './date'

// Squad Chat limits shared by the API and the client, so the composer refuses what the server would.
export const CHAT = {
  MESSAGE_MAX_LENGTH: 500,
  MESSAGE_MAX_LINE_BREAKS: 10,
  // Anti-spam: a member sends at most RATE_LIMIT messages in any RATE_WINDOW_MS of one Squad.
  RATE_LIMIT: 5,
  RATE_WINDOW_MS: 10_000,
  HISTORY_PAGE_SIZE: 50,
  // Typing: a client signals at most once per throttle, and a signal lives one TTL.
  TYPING_THROTTLE_MS: 2_000,
  TYPING_TTL_MS: 4_000,
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

// The length limit applies to the stored body, so it always fits the column's check. Links are refused, so
// the Discord invite is shared only by the complete Squad.
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
      // A body over the limit is already refused, so the link check never scans an oversized one.
      .refine((body) => body.length > CHAT.MESSAGE_MAX_LENGTH || !containsLink(body), {
        message: 'Links are not allowed in the chat',
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

// `before` is the id of the oldest message the reader holds; the page returned is the one before it.
export const chatHistoryQuerySchema = z.object({
  before: z.uuid().optional(),
})

export type ChatHistoryQuery = z.infer<typeof chatHistoryQuerySchema>

// Items come oldest first; `hasMore` says an older page exists.
export const chatHistoryResponseSchema = z.object({
  items: z.array(chatMessageSchema),
  hasMore: z.boolean(),
})

export type ChatHistoryResponse = z.infer<typeof chatHistoryResponseSchema>
