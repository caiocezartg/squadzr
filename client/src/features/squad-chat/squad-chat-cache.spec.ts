import { describe, expect, it } from 'vitest'
import type { ChatMessageDto } from '@squadzr/schemas'
import {
  messagesOf,
  removeMessage,
  squadChatQueryKey,
  upsertMessage,
  type ChatHistoryData,
} from './squad-chat-cache'

function message(id: string, createdAt: string, body = id): ChatMessageDto {
  return {
    id,
    roomCode: 'ABC123',
    body,
    createdAt,
    author: { id: 'ana', name: 'Ana', image: null },
  }
}

function history(...pages: ChatMessageDto[][]): ChatHistoryData {
  return {
    pages: pages.map((items) => ({ items, hasMore: false })),
    pageParams: pages.map(() => undefined),
  }
}

describe('squadChatQueryKey', () => {
  it('uppercases the code so every spelling shares one cache entry', () => {
    expect(squadChatQueryKey('abc123')).toEqual(['squad-chat', 'ABC123'])
  })
})

describe('messagesOf', () => {
  it('reads older pages first, each page oldest first', () => {
    const data = history(
      [message('c', '2026-01-01T00:00:03.000Z'), message('d', '2026-01-01T00:00:04.000Z')],
      [message('a', '2026-01-01T00:00:01.000Z'), message('b', '2026-01-01T00:00:02.000Z')]
    )

    expect(messagesOf(data).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('lists a message that two pages hold once', () => {
    const shared = message('b', '2026-01-01T00:00:02.000Z')
    const data = history([shared], [message('a', '2026-01-01T00:00:01.000Z'), shared])

    expect(messagesOf(data).map((item) => item.id)).toEqual(['a', 'b'])
  })
})

describe('upsertMessage', () => {
  it('inserts a message at its place in time', () => {
    const data = history([
      message('a', '2026-01-01T00:00:01.000Z'),
      message('c', '2026-01-01T00:00:03.000Z'),
    ])

    const next = upsertMessage(data, message('b', '2026-01-01T00:00:02.000Z'))

    expect(messagesOf(next).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('orders messages of the same millisecond by id, as the server does', () => {
    const data = history([message('b', '2026-01-01T00:00:01.000Z')])

    const next = upsertMessage(data, message('a', '2026-01-01T00:00:01.000Z'))

    expect(messagesOf(next).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('replaces a message that carries the same id instead of duplicating it', () => {
    const data = history([message('a', '2026-01-01T00:00:01.000Z', 'optimistic')])

    const next = upsertMessage(data, message('a', '2026-01-01T00:00:02.000Z', 'stored'))

    expect(messagesOf(next)).toEqual([message('a', '2026-01-01T00:00:02.000Z', 'stored')])
  })

  it('leaves the input untouched', () => {
    const data = history([message('a', '2026-01-01T00:00:01.000Z')])
    const snapshot = structuredClone(data)

    upsertMessage(data, message('b', '2026-01-01T00:00:02.000Z'))

    expect(data).toEqual(snapshot)
  })

  it('keeps the older pages as they are', () => {
    const older = [message('a', '2026-01-01T00:00:01.000Z')]
    const data = history([message('b', '2026-01-01T00:00:02.000Z')], older)

    const next = upsertMessage(data, message('c', '2026-01-01T00:00:03.000Z'))

    expect(next.pages[1]?.items).toEqual(older)
  })
})

describe('removeMessage', () => {
  it('drops the message wherever it is', () => {
    const data = history(
      [message('b', '2026-01-01T00:00:02.000Z')],
      [message('a', '2026-01-01T00:00:01.000Z')]
    )

    expect(messagesOf(removeMessage(data, 'a')).map((item) => item.id)).toEqual(['b'])
  })
})
