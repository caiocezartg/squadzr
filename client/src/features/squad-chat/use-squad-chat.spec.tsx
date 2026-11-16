import type { ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatHistoryResponse, ChatMessageDto } from '@squadzr/schemas'
import type { RealtimeEventSubscribe, RealtimeStatus } from '@/lib/ws-client'
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
import { useSquadChatCommands } from './squad-chat-commands'
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

/** What the chat reads of a Squad snapshot: the code of the Squad the socket joined. */
function snapshotOf(code: string) {
  return { room: { code } }
}

/** The Lobby's channel as the chat sees it: the socket's event registration, driven by the test. */
function createLiveEvents() {
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  const on: RealtimeEventSubscribe = (type, handler) => {
    const registered = handler as (payload: unknown) => void
    const set = handlers.get(type) ?? new Set()
    set.add(registered)
    handlers.set(type, set)
    return () => {
      set.delete(registered)
    }
  }
  async function emit(type: string, payload: unknown): Promise<void> {
    await act(async () => {
      for (const handler of handlers.get(type) ?? []) handler(payload)
      // The query cache tells its observers on the next task, so the render has run when this returns.
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
  return { on, emit }
}

type LiveEvents = ReturnType<typeof createLiveEvents>

interface ChannelProps {
  readonly status: RealtimeStatus
  readonly membershipRevoked: boolean
  readonly open: boolean
}

function renderChat(queryClient: QueryClient, enabled = true, initial: Partial<ChannelProps> = {}) {
  const live = createLiveEvents()
  let current: ChannelProps = { status: 'open', membershipRevoked: false, open: false, ...initial }
  const view = renderHook(
    (props: ChannelProps) =>
      useSquadChat(
        CODE,
        { status: props.status, membershipRevoked: props.membershipRevoked, on: live.on },
        { enabled, open: props.open }
      ),
    { wrapper: Providers(queryClient), initialProps: current }
  )
  /** Changes what the Lobby's channel reports, as a reconnect or a revocation would. */
  function setChannel(patch: Partial<ChannelProps>): void {
    current = { ...current, ...patch }
    view.rerender(current)
  }
  return { ...view, live, setChannel }
}

/** Newest-first pages, as the server answers them. */
function fakePage(from: number, to: number, hasMore: boolean): ChatHistoryResponse {
  const items = []
  for (let n = from; n <= to; n += 1) {
    items.push(stored(`m${n}`, `2026-01-01T10:${String(n).padStart(2, '0')}:00.000Z`))
  }
  return { items, hasMore }
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

    const live = createLiveEvents()
    const { result } = renderHook(
      () => {
        const chat = useSquadChat(
          CODE,
          { status: 'open', membershipRevoked: false, on: live.on },
          { enabled: true, open: false }
        )
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

/** The command the Lobby runs on a revoked Membership, outside any component. */
function commandsOf(queryClient: QueryClient) {
  return renderHook(() => useSquadChatCommands(), { wrapper: Providers(queryClient) }).result
    .current
}

/** The socket drops and returns, as a lost connection does. */
async function reconnect(view: {
  setChannel: (patch: Partial<ChannelProps>) => void
  live: LiveEvents
}): Promise<void> {
  act(() => view.setChannel({ status: 'reconnecting' }))
  act(() => view.setChannel({ status: 'open' }))
  await view.live.emit('room_snapshot', snapshotOf(CODE))
}

describe('reconnecting', () => {
  it('reads the history again after the socket dropped and came back', async () => {
    const { result, setChannel, live } = renderChat(createTestQueryClient())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await live.emit('room_snapshot', snapshotOf(CODE))
    onHttp('GET', '/api/rooms/:code/messages', () =>
      httpOk(
        history(stored('a', '2026-01-01T10:00:00.000Z'), stored('c', '2026-01-01T10:02:00.000Z'))
      )
    )

    await reconnect({ setChannel, live })

    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual([uid('a'), uid('c')])
    )
    expect(result.current.status).toBe('ready')
  })

  it('reads the history again once, when the socket first joins the Squad', async () => {
    const { result, live } = renderChat(createTestQueryClient())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const reads = countHttpCalls('GET', '/api/rooms/:code/messages')

    await live.emit('room_snapshot', snapshotOf(CODE))
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads + 1))

    // Every Membership change sends a snapshot: none of them reads the history.
    await live.emit('room_snapshot', snapshotOf(CODE))
    await live.emit('room_snapshot', snapshotOf(CODE))
    await act(async () => {})
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads + 1)
  })

  it('ignores the snapshot of another Squad', async () => {
    const { result, live } = renderChat(createTestQueryClient())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const reads = countHttpCalls('GET', '/api/rooms/:code/messages')

    await live.emit('room_snapshot', snapshotOf('OTHER1'))
    await act(async () => {})

    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads)
  })

  it('does not read again for a socket that merely reopens, until the Squad snapshot arrives', async () => {
    const { result, live, setChannel } = renderChat(createTestQueryClient())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await live.emit('room_snapshot', snapshotOf(CODE))
    await act(async () => {})
    const reads = countHttpCalls('GET', '/api/rooms/:code/messages')

    act(() => setChannel({ status: 'reconnecting' }))
    act(() => setChannel({ status: 'open' }))
    await act(async () => {})

    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads)
  })

  it('reads a history cached by an earlier visit again as the Lobby opens, keeping it on screen', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData<ChatHistoryData>(squadChatQueryKey(CODE), {
      pages: [history(stored('old', '2026-01-01T09:00:00.000Z'))],
      pageParams: [undefined],
    })
    const statuses: string[] = []
    const { result } = renderChat(queryClient)
    statuses.push(result.current.status)

    expect(result.current.status).toBe('ready')
    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual([uid('a'), uid('b')])
    )
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(1)
    expect(result.current.status).toBe('ready')
  })

  it('waits for a pending send before reading, so the read cannot drop its message', async () => {
    const reply = deferred<MockHttpResponse>()
    onHttp('POST', '/api/rooms/:code/messages', () => reply.promise)
    const { result, setChannel, live } = renderChat(createTestQueryClient())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await live.emit('room_snapshot', snapshotOf(CODE))
    let outcome!: Promise<unknown>
    act(() => {
      outcome = result.current.send('pending')
    })
    await waitFor(() => expect(result.current.isSending).toBe(true))
    const reads = countHttpCalls('GET', '/api/rooms/:code/messages')

    await reconnect({ setChannel, live })
    await act(async () => {})
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads)

    reply.resolve(
      httpCreated({
        ...stored('pending', '2026-01-01T10:05:00.000Z'),
        id: result.current.messages.at(-1)?.id,
        author: { id: 'me', name: 'Caio', image: null },
      })
    )
    await act(async () => {
      await outcome
    })

    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads + 1))
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

  it('uses a new id after the server refused the send', async () => {
    onHttp('POST', '/api/rooms/:code/messages', () =>
      httpError(409, { error: 'CHAT_MESSAGE_ID_CONFLICT', message: 'taken' })
    )
    const { result } = await readyChat()

    for (let i = 0; i < 2; i += 1) {
      await act(async () => {
        await result.current.send('same')
      })
    }

    const ids = getHttpLog()
      .filter((request) => request.method === 'POST')
      .map((request) => (request.body as { id: string }).id)
    expect(ids[1]).not.toBe(ids[0])
  })

  it('draws no message as pending once a send failed', async () => {
    onHttp('POST', '/api/rooms/:code/messages', () => {
      throw new TypeError('response lost')
    })
    const { result, setChannel, live } = await readyChat()
    await live.emit('room_snapshot', snapshotOf(CODE))
    await act(async () => {
      await result.current.send('lost')
    })
    const failedId = getHttpLog()
      .filter((request) => request.method === 'POST')
      .map((request) => (request.body as { id: string }).id)[0]
    onHttp('GET', '/api/rooms/:code/messages', () =>
      httpOk(history({ ...stored('lost', '2026-01-01T10:05:00.000Z'), id: failedId ?? '' }))
    )

    await reconnect({ setChannel, live })

    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual([failedId])
    )
    expect(result.current.messages[0]?.pending).toBe(false)
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

describe('live messages', () => {
  const FROM_ANA = {
    ...stored('live', '2026-01-01T10:03:00.000Z', 'chegou ao vivo'),
    id: uid('live'),
  }

  async function readyChat(
    initial: Partial<ChannelProps> = {},
    queryClient = createTestQueryClient()
  ) {
    const view = renderChat(queryClient, true, initial)
    await waitFor(() => expect(view.result.current.status).toBe('ready'))
    return { ...view, queryClient }
  }

  it('merges a message of this Squad into the history in order', async () => {
    const { result, live } = await readyChat()

    await live.emit('chat_message', { message: FROM_ANA })

    expect(result.current.messages.map((message) => message.id)).toEqual([
      uid('a'),
      uid('b'),
      uid('live'),
    ])
    expect(result.current.messages.at(-1)?.pending).toBe(false)
  })

  it('shows a message once, however often it arrives', async () => {
    const { result, live } = await readyChat()

    await live.emit('chat_message', { message: FROM_ANA })
    await live.emit('chat_message', { message: FROM_ANA })

    expect(result.current.messages.filter((message) => message.id === uid('live'))).toHaveLength(1)
  })

  it('ignores a message of another Squad', async () => {
    const { result, live } = await readyChat()

    await live.emit('chat_message', { message: { ...FROM_ANA, roomCode: 'OTHER1' } })

    expect(result.current.messages).toHaveLength(2)
  })

  it('reads the history again when a message arrives before any history was cached', async () => {
    const first = deferred<MockHttpResponse>()
    let reads = 0
    onHttp('GET', '/api/rooms/:code/messages', () => {
      reads += 1
      return reads === 1
        ? first.promise
        : httpOk(history(stored('a', '2026-01-01T10:00:00.000Z'), FROM_ANA))
    })
    const { result, live } = renderChat(createTestQueryClient())

    await live.emit('chat_message', { message: FROM_ANA })
    first.resolve(httpOk(history(stored('a', '2026-01-01T10:00:00.000Z'))))

    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual([uid('a'), uid('live')])
    )
    expect(reads).toBe(2)
  })

  it('stops listening once the viewer is no longer a member', async () => {
    const { result, live, rerender } = renderChat(createTestQueryClient(), false)

    await live.emit('chat_message', { message: FROM_ANA })
    rerender({ status: 'open', membershipRevoked: false, open: false })

    expect(result.current.messages).toEqual([])
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(0)
  })
})

describe('the author echo and the HTTP response', () => {
  async function pendingSend() {
    const reply = deferred<MockHttpResponse>()
    onHttp('POST', '/api/rooms/:code/messages', () => reply.promise)
    const view = renderChat(createTestQueryClient())
    await waitFor(() => expect(view.result.current.status).toBe('ready'))
    let outcome!: Promise<unknown>
    act(() => {
      outcome = view.result.current.send('race')
    })
    await waitFor(() => expect(view.result.current.messages).toHaveLength(3))
    const id = view.result.current.messages.at(-1)?.id ?? ''
    const own = {
      ...stored('race', '2026-01-01T10:05:00.000Z', 'race'),
      id,
      author: { id: 'me', name: 'Caio', image: null },
    }
    return { ...view, reply, outcome: () => outcome, id, own }
  }

  it('reconciles into one message when the echo arrives first', async () => {
    const { result, live, reply, outcome, id, own } = await pendingSend()

    await live.emit('chat_message', { message: own })
    expect(result.current.messages.filter((message) => message.id === id)).toHaveLength(1)
    reply.resolve(httpCreated(own))
    await act(async () => {
      await outcome()
    })

    expect(result.current.messages.filter((message) => message.id === id)).toHaveLength(1)
    expect(result.current.messages.at(-1)).toMatchObject({ id, pending: false })
    expect(result.current.unreadCount).toBe(0)
  })

  it('reconciles into one message when the response arrives first', async () => {
    const { result, live, reply, outcome, id, own } = await pendingSend()

    reply.resolve(httpCreated(own))
    await act(async () => {
      await outcome()
    })
    await live.emit('chat_message', { message: own })

    expect(result.current.messages.filter((message) => message.id === id)).toHaveLength(1)
    expect(result.current.messages.at(-1)).toMatchObject({ id, pending: false })
  })

  it('shows the echo of an own message sent from another tab', async () => {
    const { result, live } = renderChat(createTestQueryClient())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await live.emit('chat_message', {
      message: {
        ...stored('tab2', '2026-01-01T10:06:00.000Z', 'da outra aba'),
        author: { id: 'me', name: 'Caio', image: null },
      },
    })

    expect(result.current.messages.at(-1)).toMatchObject({ id: uid('tab2'), pending: false })
  })
})

describe('the unread count', () => {
  const FROM_ANA = stored('live', '2026-01-01T10:03:00.000Z')

  async function readyChat(initial: Partial<ChannelProps> = {}) {
    const view = renderChat(createTestQueryClient(), true, initial)
    await waitFor(() => expect(view.result.current.status).toBe('ready'))
    return view
  }

  it('counts messages from others while the window is closed', async () => {
    const { result, live } = await readyChat()

    await live.emit('chat_message', { message: FROM_ANA })
    await live.emit('chat_message', { message: stored('live2', '2026-01-01T10:04:00.000Z') })

    expect(result.current.unreadCount).toBe(2)
  })

  it('does not count the viewer own messages, from this tab or another', async () => {
    const { result, live } = await readyChat()

    await live.emit('chat_message', {
      message: { ...FROM_ANA, author: { id: 'me', name: 'Caio', image: null } },
    })

    expect(result.current.unreadCount).toBe(0)
  })

  it('does not count a message it already holds, nor one that arrives twice', async () => {
    const { result, live } = await readyChat()

    await live.emit('chat_message', { message: stored('a', '2026-01-01T10:00:00.000Z') })
    await live.emit('chat_message', { message: FROM_ANA })
    await live.emit('chat_message', { message: FROM_ANA })

    expect(result.current.unreadCount).toBe(1)
  })

  it('does not count while the window is open', async () => {
    const { result, live } = await readyChat({ open: true })

    await live.emit('chat_message', { message: FROM_ANA })

    expect(result.current.unreadCount).toBe(0)
  })

  it('goes back to zero when the window opens, and counts again once it closes', async () => {
    const { result, live, setChannel } = await readyChat()
    await live.emit('chat_message', { message: FROM_ANA })
    expect(result.current.unreadCount).toBe(1)

    act(() => setChannel({ open: true }))
    expect(result.current.unreadCount).toBe(0)

    act(() => setChannel({ open: false }))
    await live.emit('chat_message', { message: stored('live2', '2026-01-01T10:04:00.000Z') })
    expect(result.current.unreadCount).toBe(1)
  })
})

describe('losing access', () => {
  async function readyChat() {
    const queryClient = createTestQueryClient()
    const view = renderChat(queryClient)
    await waitFor(() => expect(view.result.current.status).toBe('ready'))
    return { ...view, queryClient }
  }

  it('does not read the history again once the Membership is revoked', async () => {
    const { queryClient, setChannel } = await readyChat()
    const reads = countHttpCalls('GET', '/api/rooms/:code/messages')

    act(() => setChannel({ membershipRevoked: true }))
    // The Lobby drops the cache on a revocation; with nothing cached, nothing may read it back.
    const commands = commandsOf(queryClient)
    act(() => commands.discardSquadChat(CODE))
    await act(async () => {})

    expect(queryClient.getQueryData(squadChatQueryKey(CODE))).toBeUndefined()
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads)
  })

  it('reads the history again when a later snapshot restores the Membership', async () => {
    const { result, setChannel, queryClient } = await readyChat()
    act(() => setChannel({ membershipRevoked: true }))
    const commands = commandsOf(queryClient)
    act(() => commands.discardSquadChat(CODE))
    onHttp('GET', '/api/rooms/:code/messages', () =>
      httpOk(history(stored('back', '2026-01-01T11:00:00.000Z')))
    )

    act(() => setChannel({ membershipRevoked: false }))

    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual([uid('back')])
    )
  })
})

describe('older history', () => {
  beforeEach(() => {
    onHttp('GET', '/api/rooms/:code/messages', ({ query }) =>
      httpOk(query.get('before') === uid('m6') ? fakePage(1, 5, false) : fakePage(6, 8, true))
    )
  })

  async function readyChat() {
    const view = renderChat(createTestQueryClient())
    await waitFor(() => expect(view.result.current.status).toBe('ready'))
    return view
  }

  it('reports more history, and none for a short one', async () => {
    onHttp('GET', '/api/rooms/:code/messages', () => httpOk(fakePage(1, 2, false)))
    const short = await readyChat()
    expect(short.result.current.hasMore).toBe(false)
  })

  it('reads the page before the oldest message held and puts it at the top', async () => {
    const { result } = await readyChat()
    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      await result.current.fetchOlder()
    })

    const fetched = getHttpLog().filter((request) => request.query.has('before'))
    expect(fetched.map((request) => request.query.get('before'))).toEqual([uid('m6')])
    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual(
        [1, 2, 3, 4, 5, 6, 7, 8].map((n) => uid(`m${n}`))
      )
    )
    expect(result.current.hasMore).toBe(false)
    expect(result.current.isFetchingOlder).toBe(false)
  })

  it('keeps the older page when a live message arrives', async () => {
    const { result, live } = await readyChat()
    await act(async () => {
      await result.current.fetchOlder()
    })

    await live.emit('chat_message', { message: stored('m9', '2026-01-01T10:09:00.000Z') })

    expect(result.current.messages.map((message) => message.id)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => uid(`m${n}`))
    )
  })

  it('keeps an older page being read when a live message arrives', async () => {
    const page = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/:code/messages', ({ query }) =>
      query.get('before') ? page.promise : httpOk(fakePage(6, 8, true))
    )
    const { result, live } = await readyChat()
    await live.emit('room_snapshot', snapshotOf(CODE))
    await act(async () => {})
    act(() => {
      void result.current.fetchOlder()
    })
    await waitFor(() => expect(result.current.isFetchingOlder).toBe(true))
    const reads = countHttpCalls('GET', '/api/rooms/:code/messages')

    await live.emit('chat_message', { message: stored('m9', '2026-01-01T10:09:00.000Z') })
    page.resolve(httpOk(fakePage(1, 5, false)))

    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => uid(`m${n}`))
      )
    )
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads)
  })

  it('reads one older page at a time', async () => {
    const page = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/:code/messages', ({ query }) =>
      query.get('before') ? page.promise : httpOk(fakePage(6, 8, true))
    )
    const { result } = await readyChat()

    act(() => {
      void result.current.fetchOlder()
    })
    await waitFor(() => expect(result.current.isFetchingOlder).toBe(true))
    await act(async () => {
      await result.current.fetchOlder()
    })
    expect(getHttpLog().filter((request) => request.query.has('before'))).toHaveLength(1)

    page.resolve(httpOk(fakePage(1, 5, false)))
    await waitFor(() => expect(result.current.isFetchingOlder).toBe(false))
  })

  it('reads from the oldest stored message, never from a pending one dated earlier', async () => {
    const reply = deferred<MockHttpResponse>()
    onHttp('POST', '/api/rooms/:code/messages', () => reply.promise)
    const { result } = await readyChat()
    // A client clock behind the server's dates the pending message before every stored one.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
    act(() => {
      void result.current.send('early clock')
    })
    vi.useRealTimers()
    await waitFor(() => expect(result.current.messages[0]?.pending).toBe(true))

    await act(async () => {
      await result.current.fetchOlder()
    })

    const fetched = getHttpLog().filter((request) => request.query.has('before'))
    expect(fetched.map((request) => request.query.get('before'))).toEqual([uid('m6')])
    await waitFor(() =>
      expect(result.current.messages.map((message) => message.body)).toContain('m1')
    )
    expect(result.current.hasMore).toBe(false)
  })

  it('does nothing when there is no older history', async () => {
    onHttp('GET', '/api/rooms/:code/messages', () => httpOk(fakePage(1, 2, false)))
    const { result } = await readyChat()

    await act(async () => {
      await result.current.fetchOlder()
    })

    expect(getHttpLog().filter((request) => request.query.has('before'))).toHaveLength(0)
  })

  it('reads every page again from the newest one after a reconnect', async () => {
    const { result, setChannel, live } = await readyChat()
    await live.emit('room_snapshot', snapshotOf(CODE))
    await act(async () => {
      await result.current.fetchOlder()
    })
    onHttp('GET', '/api/rooms/:code/messages', ({ query }) =>
      httpOk(query.get('before') === uid('m7') ? fakePage(2, 6, false) : fakePage(7, 9, true))
    )

    await reconnect({ setChannel, live })

    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual(
        [2, 3, 4, 5, 6, 7, 8, 9].map((n) => uid(`m${n}`))
      )
    )
  })
})
