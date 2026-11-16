import { describe, expect, it } from 'vitest'
import {
  CHAT,
  chatHistoryResponseSchema,
  chatMessageBodySchema,
  chatMessageSchema,
  sendChatMessageRequestSchema,
} from './chat'

const ID = '0b7a6a3e-5f43-4f0b-8f4a-0d3f1c9a2b11'

const message = {
  id: ID,
  roomCode: 'ABC123',
  body: 'oi',
  createdAt: '2026-01-01T00:00:00.000Z',
  author: { id: 'user-1', name: 'Ana', image: null },
}

describe('chatMessageBodySchema', () => {
  it('trims the body', () => {
    expect(chatMessageBodySchema.parse('  oi  ')).toBe('oi')
  })

  it.each(['', '   ', '\n\t \n'])('refuses the empty body %j', (body) => {
    expect(chatMessageBodySchema.safeParse(body).success).toBe(false)
  })

  it('refuses a body made only of zero-width characters', () => {
    expect(chatMessageBodySchema.safeParse('​‌‍﻿').success).toBe(false)
    expect(chatMessageBodySchema.safeParse(' ​ ﻿ ').success).toBe(false)
  })

  it('strips zero-width characters before the length check', () => {
    expect(chatMessageBodySchema.parse('o​i')).toBe('oi')
    const padded = `${'a'.repeat(CHAT.MESSAGE_MAX_LENGTH)}​​`
    expect(chatMessageBodySchema.parse(padded)).toBe('a'.repeat(CHAT.MESSAGE_MAX_LENGTH))
  })

  it('accepts exactly the maximum length and refuses one more', () => {
    expect(chatMessageBodySchema.safeParse('a'.repeat(CHAT.MESSAGE_MAX_LENGTH)).success).toBe(true)
    expect(chatMessageBodySchema.safeParse('a'.repeat(CHAT.MESSAGE_MAX_LENGTH + 1)).success).toBe(
      false
    )
  })

  it('accepts exactly the maximum line breaks and refuses one more', () => {
    const ok = Array.from({ length: CHAT.MESSAGE_MAX_LINE_BREAKS + 1 }, () => 'a').join('\n')
    const tooMany = `${ok}\na`
    expect(chatMessageBodySchema.safeParse(ok).success).toBe(true)
    expect(chatMessageBodySchema.safeParse(tooMany).success).toBe(false)
  })

  it('counts a Windows line break once', () => {
    const body = Array.from({ length: CHAT.MESSAGE_MAX_LINE_BREAKS + 1 }, () => 'a').join('\r\n')
    expect(chatMessageBodySchema.safeParse(body).success).toBe(true)
  })

  it('does not count line breaks that trimming removes', () => {
    const body = `\n\n\n\n\n\n\n\n\n\n\n\nhi\n\n\n\n\n\n\n\n\n\n\n\n`
    expect(chatMessageBodySchema.parse(body)).toBe('hi')
  })

  it('refuses a value that is not a string', () => {
    expect(chatMessageBodySchema.safeParse(42).success).toBe(false)
  })
})

describe('sendChatMessageRequestSchema', () => {
  it('requires a UUID id and a valid body', () => {
    expect(sendChatMessageRequestSchema.parse({ id: ID, body: ' oi ' })).toEqual({
      id: ID,
      body: 'oi',
    })
    expect(sendChatMessageRequestSchema.safeParse({ id: 'nope', body: 'oi' }).success).toBe(false)
    expect(sendChatMessageRequestSchema.safeParse({ id: ID, body: ' ' }).success).toBe(false)
    expect(sendChatMessageRequestSchema.safeParse({ body: 'oi' }).success).toBe(false)
  })
})

describe('chatMessageSchema', () => {
  it('accepts a message with and without an author image', () => {
    expect(chatMessageSchema.safeParse(message).success).toBe(true)
    const withImage = { ...message, author: { ...message.author, image: 'https://x.test/a.png' } }
    expect(chatMessageSchema.safeParse(withImage).success).toBe(true)
  })

  it('refuses a message whose date is not an ISO instant', () => {
    expect(chatMessageSchema.safeParse({ ...message, createdAt: 'yesterday' }).success).toBe(false)
  })
})

describe('chatHistoryResponseSchema', () => {
  it('carries the items and hasMore', () => {
    const parsed = chatHistoryResponseSchema.parse({ items: [message], hasMore: true })
    expect(parsed.items).toHaveLength(1)
    expect(parsed.hasMore).toBe(true)
  })

  it('requires hasMore', () => {
    expect(chatHistoryResponseSchema.safeParse({ items: [] }).success).toBe(false)
  })
})

describe('CHAT', () => {
  it('holds the Squad Chat constants', () => {
    expect(CHAT).toMatchObject({
      MESSAGE_MAX_LENGTH: 500,
      MESSAGE_MAX_LINE_BREAKS: 10,
      HISTORY_PAGE_SIZE: 50,
    })
  })
})
