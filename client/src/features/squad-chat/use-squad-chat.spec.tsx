import type { ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ChatHistoryResponse, ChatMessageDto } from '@squadzr/schemas'
import { createTestQueryClient } from '@/test/harness'
import {
  countHttpCalls,
  getHttpLog,
  httpCreated,
  httpError,
  httpOk,
  onHttp,
  type MockHttpResponse,
} from '@/test/http-router'
import { withEnglishIntl } from '@/test/intl'
import { signInAsFakeUser } from '@/test/stubs'
import {
  messagesOf,
  squadChatQueryKey,
  upsertMessage,
  type ChatHistoryData,
} from './squad-chat-cache'
import { useSquadChat } from './use-squad-chat'

const CODE = 'ABC123'
const ANA = { id: 'ana', name: 'Ana', image: null }

/** A well-formed message id, since the response contract demands a UUID. */
function uid(name: string): string {
  const hex = [...name].map((letter) => letter.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  return `00000000-0000-4000-8000-${hex.padStart(12, '0').slice(-12)}`
}

function stored(name: string, createdAt: string, body = name): ChatMessageDto {
  return { id: uid(name), roomCode: CODE, body, createdAt, author: ANA }
}

function history(...items: ChatMessageDto[]): ChatHistoryResponse {
  return { items, hasMore: false }
}

function Providers(queryClient: QueryClient) {
  return withEnglishIntl(function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  })
}

function renderChat(queryClient: QueryClient, enabled = true) {
  return renderHook(() => useSquadChat(CODE, { enabled }), { wrapper: Providers(queryClient) })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  signInAsFakeUser({ id: 'me', name: 'Caio', image: 'https://x.test/me.png' })
  onHttp('GET', '/api/rooms/:code/messages', () =>
    httpOk(
      history(stored('a', '2026-01-01T10:00:00.000Z'), stored('b', '2026-01-01T10:01:00.000Z'))
    )
  )
})

describe('reading the history', () => {
  it('loads the latest page, oldest first', async () => {
    const { result } = renderChat(createTestQueryClient())

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.messages.map((message) => message.id)).toEqual([uid('a'), uid('b')])
    expect(result.current.messages.every((message) => !message.pending)).toBe(true)
  })

  it('does not read for a viewer who is not a member', async () => {
    const { result } = renderChat(createTestQueryClient(), false)

    await act(async () => {})

    expect(result.current.status).toBe('loading')
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(0)
  })

  it('opens ready at once on a warm cache, with no loading state at any render', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData<ChatHistoryData>(squadChatQueryKey(CODE), {
      pages: [history(stored('warm', '2026-01-01T09:00:00.000Z'))],
      pageParams: [undefined],
    })
    const statuses: string[] = []

    const { result } = renderHook(
      () => {
        const chat = useSquadChat(CODE, { enabled: true })
        statuses.push(chat.status)
        return chat
      },
      { wrapper: Providers(queryClient) }
    )

    expect(result.current.messages.map((message) => message.id)).toEqual([uid('warm')])
    expect(new Set(statuses)).toEqual(new Set(['ready']))
  })

  it('reports an error with no cached history and reads again on retry', async () => {
    onHttp('GET', '/api/rooms/:code/messages', () =>
      httpError(500, { error: 'INTERNAL_ERROR', message: 'boom' })
    )
    const { result } = renderChat(createTestQueryClient())
    await waitFor(() => expect(result.current.status).toBe('error'))

    onHttp('GET', '/api/rooms/:code/messages', () =>
      httpOk(history(stored('a', '2026-01-01T10:00:00.000Z')))
    )
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.status).toBe('ready'))
  })
})

describe('sending', () => {
  async function readyChat(queryClient = createTestQueryClient()) {
    const view = renderChat(queryClient)
    await waitFor(() => expect(view.result.current.status).toBe('ready'))
    return { ...view, queryClient }
  }

  it('shows a pending message at once and replaces it with the server message', async () => {
    const reply = deferred<MockHttpResponse>()
    onHttp('POST', '/api/rooms/:code/messages', () => reply.promise)
    const { result } = await readyChat()

    let outcome!: Promise<unknown>
    act(() => {
      outcome = result.current.send('  hello squad  ')
    })

    await waitFor(() => expect(result.current.messages).toHaveLength(3))
    const optimistic = result.current.messages.at(-1)
    expect(optimistic).toMatchObject({
      body: 'hello squad',
      pending: true,
      author: { id: 'me', name: 'Caio', image: 'https://x.test/me.png' },
    })
    expect(result.current.isSending).toBe(true)

    const sent = getHttpLog().find((request) => request.method === 'POST')
    expect(sent?.body).toEqual({ id: optimistic?.id, body: 'hello squad' })
    expect(optimistic?.id).toMatch(/^[0-9a-f-]{36}$/)

    reply.resolve(
      httpCreated({
        id: optimistic?.id,
        roomCode: CODE,
        body: 'hello squad',
        createdAt: '2026-01-01T10:05:00.000Z',
        author: { id: 'me', name: 'Caio', image: 'https://x.test/me.png' },
      })
    )
    await act(async () => {
      await outcome
    })

    expect(result.current.messages).toHaveLength(3)
    expect(result.current.messages.at(-1)).toMatchObject({
      id: optimistic?.id,
      pending: false,
      createdAt: '2026-01-01T10:05:00.000Z',
    })
    expect(result.current.isSending).toBe(false)
  })

  it('answers ok once the server stored the message', async () => {
    onHttp('POST', '/api/rooms/:code/messages', ({ body }) =>
      httpCreated({
        ...(body as { id: string; body: string }),
        roomCode: CODE,
        createdAt: '2026-01-01T10:05:00.000Z',
        author: { id: 'me', name: 'Caio', image: null },
      })
    )
    const { result } = await readyChat()

    let outcome
    await act(async () => {
      outcome = await result.current.send('hi')
    })

    expect(outcome).toEqual({ ok: true })
  })

  it('keeps one message when the server echo lands before the response', async () => {
    const reply = deferred<MockHttpResponse>()
    onHttp('POST', '/api/rooms/:code/messages', () => reply.promise)
    const { result, queryClient } = await readyChat()
    let outcome!: Promise<unknown>
    act(() => {
      outcome = result.current.send('race')
    })
    await waitFor(() => expect(result.current.messages).toHaveLength(3))
    const id = result.current.messages.at(-1)?.id ?? ''
    const echo = { ...stored('race', '2026-01-01T10:05:00.000Z', 'race'), id, author: ANA }

    act(() => {
      queryClient.setQueryData<ChatHistoryData>(
        squadChatQueryKey(CODE),
        (data) => data && upsertMessage(data, echo)
      )
    })
    reply.resolve(httpCreated(echo))
    await act(async () => {
      await outcome
    })

    const ids = messagesOf(queryClient.getQueryData<ChatHistoryData>(squadChatQueryKey(CODE))!).map(
      (message) => message.id
    )
    expect(ids.filter((value) => value === id)).toHaveLength(1)
    expect(result.current.messages.filter((message) => message.id === id)).toHaveLength(1)
  })

  it('takes the message back out and hands the text back when the send fails', async () => {
    onHttp('POST', '/api/rooms/:code/messages', () =>
      httpError(422, { error: 'NOT_ROOM_MEMBER', message: 'no' })
    )
    const { result } = await readyChat()

    let outcome
    await act(async () => {
      outcome = await result.current.send('  keep me  ')
    })

    expect(outcome).toEqual({
      ok: false,
      reason: 'failed',
      text: '  keep me  ',
      code: 'NOT_ROOM_MEMBER',
    })
    expect(result.current.messages.map((message) => message.id)).toEqual([uid('a'), uid('b')])
    expect(result.current.isSending).toBe(false)
  })

  it('reuses the failed message id when the same text is sent again, so it is stored once', async () => {
    onHttp('POST', '/api/rooms/:code/messages', () => {
      throw new TypeError('response lost')
    })
    const { result } = await readyChat()
    const postedIds = () =>
      getHttpLog()
        .filter((request) => request.method === 'POST')
        .map((request) => (request.body as { id: string }).id)

    await act(async () => {
      await result.current.send('  again  ')
    })
    await act(async () => {
      await result.current.send('again')
    })
    await act(async () => {
      await result.current.send('something else')
    })

    const [first, retried, other] = postedIds()
    expect(retried).toBe(first)
    expect(other).not.toBe(first)
  })

  it('uses a new id after a send succeeds', async () => {
    let calls = 0
    onHttp('POST', '/api/rooms/:code/messages', ({ body }) => {
      calls += 1
      if (calls === 1) throw new TypeError('response lost')
      return httpCreated({
        ...(body as { id: string; body: string }),
        roomCode: CODE,
        createdAt: '2026-01-01T10:05:00.000Z',
        author: { id: 'me', name: 'Caio', image: null },
      })
    })
    const { result } = await readyChat()

    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await result.current.send('same')
      })
    }

    const ids = getHttpLog()
      .filter((request) => request.method === 'POST')
      .map((request) => (request.body as { id: string }).id)
    expect(ids[1]).toBe(ids[0])
    expect(ids[2]).not.toBe(ids[1])
  })

  it('reports no error code when the request itself failed', async () => {
    onHttp('POST', '/api/rooms/:code/messages', () => {
      throw new TypeError('network down')
    })
    const { result } = await readyChat()

    let outcome
    await act(async () => {
      outcome = await result.current.send('hello')
    })

    expect(outcome).toEqual({ ok: false, reason: 'failed', text: 'hello', code: null })
    expect(result.current.messages).toHaveLength(2)
  })

  it.each(['', '   ', '​‌', 'a'.repeat(501)])('refuses %j without a request', async (text) => {
    const { result } = await readyChat()

    let outcome
    await act(async () => {
      outcome = await result.current.send(text)
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid', text })
    expect(countHttpCalls('POST', '/api/rooms/:code/messages')).toBe(0)
  })

  it('holds a second send back while the first is pending', async () => {
    const reply = deferred<MockHttpResponse>()
    onHttp('POST', '/api/rooms/:code/messages', () => reply.promise)
    const { result } = await readyChat()
    act(() => {
      void result.current.send('first')
    })

    let second
    await act(async () => {
      second = await result.current.send('second')
    })

    expect(second).toMatchObject({ ok: false, reason: 'busy', text: 'second' })
    expect(countHttpCalls('POST', '/api/rooms/:code/messages')).toBe(1)
  })

  it('reads the history again when the send finishes before any history was cached', async () => {
    const queryClient = createTestQueryClient()
    const first = deferred<MockHttpResponse>()
    let reads = 0
    onHttp('GET', '/api/rooms/:code/messages', () => {
      reads += 1
      return reads === 1
        ? first.promise
        : httpOk(history(stored('later', '2026-01-01T10:09:00.000Z')))
    })
    onHttp('POST', '/api/rooms/:code/messages', ({ body }) =>
      httpCreated({
        ...(body as { id: string; body: string }),
        roomCode: CODE,
        createdAt: '2026-01-01T10:05:00.000Z',
        author: { id: 'me', name: 'Caio', image: null },
      })
    )
    const { result } = renderChat(queryClient)

    await act(async () => {
      await result.current.send('early bird')
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.messages.map((message) => message.id)).toEqual([uid('later')])
    expect(reads).toBe(2)
  })
})
