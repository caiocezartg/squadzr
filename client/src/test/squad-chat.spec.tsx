/**
 * Flow tests of the Squad Chat in the Lobby: the launcher only for members, the non-modal window and its
 * focus, the history laid out left and right, the optimistic send, a failed send, and links.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessageDto } from '@squadzr/schemas'
import { NARROW_QUERY } from '@/components/ds/use-media-query'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import {
  countHttpCalls,
  getHttpLog,
  httpCreated,
  httpError,
  httpOk,
  onHttp,
  type MockHttpResponse,
} from './http-router'
import {
  boardSquads,
  guestPlayer,
  hostPlayer,
  lobbySnapshot,
  readyLobbySnapshot,
  lobbySquad,
  lobbySquadResponse,
} from './fixtures'
import { mockMediaQuery } from './media-query'
import { settleNavigation } from './navigation'
import { openLatestWebSocket, sendFromServer, serverSentFrames } from './ws-flows'
import { latestWebSocket } from './ws-mock'

const CODE = 'LOBBY1'
const ME = { id: hostPlayer.id, name: hostPlayer.name, image: null }
const ANA = { id: guestPlayer.id, name: guestPlayer.name, image: guestPlayer.image }

function message(n: number, author: ChatMessageDto['author'], body: string): ChatMessageDto {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    roomCode: CODE,
    body,
    createdAt: new Date(Date.now() - (10 - n) * 60_000).toISOString(),
    author,
  }
}

const HISTORY = [message(1, ANA, 'oi time'), message(2, ME, 'bora jogar')]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function registerRoutes(items: ChatMessageDto[] = HISTORY): void {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))
  onHttp('GET', '/api/rooms/:code/discord-preview', () => httpOk({ preview: null }))
  onHttp('GET', '/api/rooms/:code/messages', () => httpOk({ items, hasMore: false }))
}

/** Opens the member Lobby with its snapshot, so the viewer is a member. */
async function openMemberLobby(options: Parameters<typeof renderSquadsFlow>[1] = {}) {
  const flow = renderSquadsFlow(`/squads/${CODE}`, options)
  await screen.findByText('Squad ready check')
  openLatestWebSocket()
  sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
  await screen.findByText('Ana')
  return flow
}

/** The socket drops and the client reconnects on its own, as a lost connection does. */
function reconnectSocket(): void {
  const dropped = latestWebSocket()
  vi.useFakeTimers()
  act(() => dropped.close(1006))
  act(() => vi.advanceTimersByTime(60_000))
  vi.useRealTimers()
  act(() => latestWebSocket().open())
  sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
}

function launcher(): HTMLElement {
  return screen.getByRole('button', { name: 'Chat' })
}

async function openChat(): Promise<HTMLElement> {
  await userEvent.click(launcher())
  return screen.findByRole('dialog', { name: 'Squad chat' })
}

beforeEach(() => {
  registerRoutes()
})

describe('the launcher', () => {
  it('shows for a member and opens the window', async () => {
    await openMemberLobby()

    expect(launcher()).toHaveAttribute('aria-expanded', 'false')
    const chat = await openChat()

    expect(launcher()).toHaveAttribute('aria-expanded', 'true')
    expect(within(chat).queryByText('2 members')).not.toBeInTheDocument()
    expect(within(chat).getByRole('textbox', { name: 'Message' })).toHaveFocus()
  })

  it('does not show to a non-member, who never reads the chat', async () => {
    const { discordLink: _discordLink, ...publicFields } = lobbySquad
    onHttp('GET', '/api/rooms/:code', () =>
      httpOk({ room: { ...publicFields, memberCount: 1, isMember: false } })
    )
    renderSquadsFlow(`/squads/${CODE}`, {
      user: { id: 'user-7', name: 'Outsider', email: 'outsider@squadzr.test', image: null },
    })

    expect(await screen.findByRole('button', { name: 'Join squad' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chat' })).not.toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(0)
  })
})

describe('the window', () => {
  it('stays open when the page is clicked, and is not modal', async () => {
    await openMemberLobby()
    await openChat()

    await userEvent.click(screen.getByText('Squad ready check'))

    expect(screen.getByRole('dialog', { name: 'Squad chat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'End squad' })).toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the launcher', async () => {
    await openMemberLobby()
    await openChat()

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(launcher()).toHaveFocus()
  })

  it('closes with its close button and returns focus to the launcher', async () => {
    await openMemberLobby()
    const chat = await openChat()

    await userEvent.click(within(chat).getByRole('button', { name: 'Close chat' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(launcher()).toHaveFocus()
  })

  it('is a bottom sheet below 640px', async () => {
    mockMediaQuery(NARROW_QUERY, true)
    await openMemberLobby()

    const chat = await openChat()

    expect(within(chat).getByRole('heading', { name: 'Squad chat' })).toBeInTheDocument()
    expect(await within(chat).findByText('oi time')).toBeInTheDocument()
  })
})

describe('the history', () => {
  it('draws others on the left and the viewer on the right', async () => {
    await openMemberLobby()
    const chat = await openChat()

    const theirs = await within(chat).findByText('oi time')
    const mine = within(chat).getByText('bora jogar')

    expect(theirs.closest('[data-own]')).toBeNull()
    expect(
      within(theirs.closest('li')!.parentElement!.parentElement!).getByText('Ana')
    ).toBeTruthy()
    expect(mine.closest('[data-own]')).not.toBeNull()
    expect(within(mine.closest('[data-own]') as HTMLElement).getByText('Caio')).toBeInTheDocument()
  })

  it('shows no skeleton when the window opens again on a warm cache', async () => {
    const queryClient = createTestQueryClient()
    await openMemberLobby({ queryClient })
    const chat = await openChat()
    await within(chat).findByText('oi time')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await userEvent.click(launcher())

    const reopened = screen.getByRole('dialog', { name: 'Squad chat' })
    expect(within(reopened).queryByTestId('chat-skeleton')).not.toBeInTheDocument()
    expect(within(reopened).getByText('oi time')).toBeInTheDocument()
  })

  it('shows a message another member sends, live, with no reload', async () => {
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')
    const reads = countHttpCalls('GET', '/api/rooms/:code/messages')

    sendFromServer({ type: 'chat_message', payload: { message: message(3, ANA, 'cheguei') } })

    expect(await within(chat).findByText('cheguei')).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads)
  })

  it('ignores a message of another Squad', async () => {
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')

    sendFromServer({
      type: 'chat_message',
      payload: { message: { ...message(3, ANA, 'outro time'), roomCode: 'OTHER1' } },
    })

    await act(async () => {})
    expect(within(chat).queryByText('outro time')).not.toBeInTheDocument()
  })

  it('reads the history again after a reconnect, so what the socket missed shows', async () => {
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')
    registerRoutes([...HISTORY, message(3, ANA, 'perdi essa')])

    reconnectSocket()

    expect(await within(chat).findByText('perdi essa')).toBeInTheDocument()
  })
})

describe('the unread badge', () => {
  const badge = () => screen.queryByTestId('chat-unread')

  async function openLobbyWithHistory(options: Parameters<typeof openMemberLobby>[0] = {}) {
    const flow = await openMemberLobby(options)
    // The history is read with the Lobby, before the window ever opens, and again once the socket joined.
    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(2))
    return flow
  }

  it('counts the messages others send while the window is closed', async () => {
    await openLobbyWithHistory()
    expect(badge()).not.toBeInTheDocument()

    sendFromServer({ type: 'chat_message', payload: { message: message(3, ANA, 'um') } })
    sendFromServer({ type: 'chat_message', payload: { message: message(4, ANA, 'dois') } })

    expect(await screen.findByTestId('chat-unread')).toHaveTextContent('2')
  })

  it('does not count the viewer own messages, such as the echo of another tab', async () => {
    await openLobbyWithHistory()

    sendFromServer({ type: 'chat_message', payload: { message: message(3, ME, 'da outra aba') } })

    await act(async () => {})
    expect(badge()).not.toBeInTheDocument()
  })

  it('resets when the window opens, and the messages are there to read', async () => {
    await openLobbyWithHistory()
    sendFromServer({ type: 'chat_message', payload: { message: message(3, ANA, 'um') } })
    await screen.findByTestId('chat-unread')

    const chat = await openChat()

    expect(badge()).not.toBeInTheDocument()
    expect(await within(chat).findByText('um')).toBeInTheDocument()
  })

  it('counts nothing while the window is open, and again once it closes', async () => {
    await openLobbyWithHistory()
    const chat = await openChat()
    sendFromServer({ type: 'chat_message', payload: { message: message(3, ANA, 'aberto') } })
    await within(chat).findByText('aberto')
    expect(badge()).not.toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    sendFromServer({ type: 'chat_message', payload: { message: message(4, ANA, 'fechado') } })

    expect(await screen.findByTestId('chat-unread')).toHaveTextContent('1')
  })
})

describe('losing access', () => {
  it('removes the chat cache and stops reading it when the Membership is revoked', async () => {
    const queryClient = createTestQueryClient()
    await openMemberLobby({ queryClient })
    await waitFor(() => expect(queryClient.getQueryData(['squad-chat', CODE])).toBeDefined())
    const reads = countHttpCalls('GET', '/api/rooms/:code/messages')

    sendFromServer({
      type: 'error',
      payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this squad' },
    })

    await screen.findByText('You are not a member of this squad.')
    expect(queryClient.getQueryData(['squad-chat', CODE])).toBeUndefined()
    expect(screen.queryByRole('button', { name: 'Chat' })).not.toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/:code/messages')).toBe(reads)
  })

  it('keeps the next Squad chat cache when the page moves on from a revoked Squad', async () => {
    const queryClient = createTestQueryClient()
    const { navigation } = await openMemberLobby({ queryClient })
    queryClient.setQueryData(['squad-chat', 'NEXT01'], {
      pages: [{ items: [message(9, ANA, 'outra squad')], hasMore: false }],
      pageParams: [undefined],
    })
    const removed: string[] = []
    queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'removed') removed.push(String(event.query.queryKey[1]))
    })

    sendFromServer({
      type: 'error',
      payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this squad' },
    })
    await screen.findByText('You are not a member of this squad.')

    navigation.router.push('/squads/NEXT01')
    await settleNavigation()

    expect(removed).not.toContain('NEXT01')
  })

  it('removes the chat cache when the Squad is deleted', async () => {
    const queryClient = createTestQueryClient()
    await openMemberLobby({ queryClient })
    await waitFor(() => expect(queryClient.getQueryData(['squad-chat', CODE])).toBeDefined())

    sendFromServer({
      type: 'room_deleted',
      payload: { roomId: lobbySquad.id, roomCode: CODE },
    })

    await waitFor(() => expect(queryClient.getQueryData(['squad-chat', CODE])).toBeUndefined())
  })
})

describe('the chat window, continued', () => {
  it('shows the error with a retry that reads again', async () => {
    onHttp('GET', '/api/rooms/:code/messages', () =>
      httpError(500, { error: 'INTERNAL_ERROR', message: 'boom' })
    )
    await openMemberLobby()
    const chat = await openChat()
    expect(await within(chat).findByText('We could not load the chat.')).toBeInTheDocument()

    registerRoutes()
    await userEvent.click(within(chat).getByRole('button', { name: 'Try again' }))

    expect(await within(chat).findByText('oi time')).toBeInTheDocument()
  })

  it('renders links safely and never renders the body as HTML', async () => {
    registerRoutes([
      message(1, ANA, 'veja https://example.com/a. e <b>negrito</b>'),
      message(2, ANA, 'javascript:alert(1)'),
    ])
    await openMemberLobby()
    const chat = await openChat()

    const link = await within(chat).findByRole('link', { name: 'https://example.com/a' })
    expect(link).toHaveAttribute('href', 'https://example.com/a')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow ugc')
    expect(within(chat).getAllByRole('link')).toHaveLength(1)
    expect(chat.querySelector('b')).toBeNull()
    expect(within(chat).getByText(/<b>negrito<\/b>/)).toBeInTheDocument()
  })
})

describe('sending', () => {
  it('shows the message as pending, then confirmed', async () => {
    const reply = deferred<MockHttpResponse>()
    let sent: { id: string; body: string } | undefined
    onHttp('POST', '/api/rooms/:code/messages', ({ body }) => {
      sent = body as { id: string; body: string }
      return reply.promise
    })
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')
    const field = within(chat).getByRole('textbox', { name: 'Message' })

    await userEvent.type(field, 'gg{Enter}')

    const pending = await within(chat).findByText('gg')
    expect(pending.closest('li')).toHaveAttribute('aria-busy', 'true')
    expect(field).toHaveValue('')
    expect(within(chat).getByRole('button', { name: 'Send' })).toBeDisabled()

    await act(async () => {
      reply.resolve(
        httpCreated({ ...sent!, roomCode: CODE, createdAt: new Date().toISOString(), author: ME })
      )
      await reply.promise
    })

    await waitFor(() =>
      expect(within(chat).getByText('gg').closest('li')).not.toHaveAttribute('aria-busy')
    )
    expect(within(chat).getAllByText('gg')).toHaveLength(1)
  })

  it('adds a line on Shift+Enter instead of sending', async () => {
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')
    const field = within(chat).getByRole('textbox', { name: 'Message' })

    await userEvent.type(field, 'a{Shift>}{Enter}{/Shift}b')

    expect(field).toHaveValue('a\nb')
    expect(countHttpCalls('POST', '/api/rooms/:code/messages')).toBe(0)
  })

  it('keeps send disabled for a blank body', async () => {
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')

    fireEvent.change(within(chat).getByRole('textbox', { name: 'Message' }), {
      target: { value: '   ' },
    })

    expect(within(chat).getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('takes the message out and puts the text back when the send fails', async () => {
    onHttp('POST', '/api/rooms/:code/messages', () =>
      httpError(500, { error: 'INTERNAL_ERROR', message: 'boom' })
    )
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')
    const field = within(chat).getByRole('textbox', { name: 'Message' })

    await userEvent.type(field, 'perdida{Enter}')

    expect(
      await within(chat).findByText('Your message was not sent. Try again.')
    ).toBeInTheDocument()
    expect(field).toHaveValue('perdida')
    expect(within(chat).queryByText('perdida', { selector: 'li span' })).not.toBeInTheDocument()
  })
})

describe('the echo of the viewer own message', () => {
  it('shows one message whether the echo or the answer comes first', async () => {
    const reply = deferred<MockHttpResponse>()
    let sent: { id: string; body: string } | undefined
    onHttp('POST', '/api/rooms/:code/messages', ({ body }) => {
      sent = body as { id: string; body: string }
      return reply.promise
    })
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')
    await userEvent.type(within(chat).getByRole('textbox', { name: 'Message' }), 'eco{Enter}')
    await within(chat).findByText('eco')
    const stored = { ...sent!, roomCode: CODE, createdAt: new Date().toISOString(), author: ME }

    sendFromServer({ type: 'chat_message', payload: { message: stored } })
    await act(async () => {})
    expect(within(chat).getAllByText('eco')).toHaveLength(1)

    await act(async () => {
      reply.resolve(httpCreated(stored))
      await reply.promise
    })

    await waitFor(() =>
      expect(within(chat).getByText('eco').closest('li')).not.toHaveAttribute('aria-busy')
    )
    expect(within(chat).getAllByText('eco')).toHaveLength(1)
  })
})

afterEach(() => {
  delete (HTMLLIElement.prototype as Partial<HTMLLIElement>).getBoundingClientRect
})

/** jsdom lays nothing out: each message row is 100px tall and the list shows 300px of them. */
function layOut(log: HTMLElement) {
  let top = 0
  const rows = () => [...log.querySelectorAll('li')]
  const height = () => rows().length * 100
  Object.defineProperty(HTMLLIElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLLIElement) {
      return DOMRect.fromRect({ y: Math.max(0, rows().indexOf(this)) * 100 - top, height: 100 })
    },
  })
  Object.defineProperties(log, {
    clientHeight: { configurable: true, get: () => 300 },
    scrollHeight: { configurable: true, get: height },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = Math.max(0, Math.min(value, height() - 300))
      },
    },
  })
  return {
    bottom: () => height() - 300,
    scrollTo(value: number) {
      log.scrollTop = value
      fireEvent.scroll(log)
    },
  }
}

const SIX = [1, 2, 3, 4, 5, 6].map((n) => message(n, ANA, `linha ${n}`))

async function openLaidOutChat() {
  registerRoutes(SIX)
  await openMemberLobby()
  const chat = await openChat()
  await within(chat).findByText('linha 6')
  const log = within(chat).getByRole('log')
  return { chat, log, layout: layOut(log) }
}

describe('scrolling', () => {
  it('follows a new message while the reader is at the bottom', async () => {
    const { chat, log, layout } = await openLaidOutChat()
    layout.scrollTo(layout.bottom())

    sendFromServer({ type: 'chat_message', payload: { message: message(7, ANA, 'nova') } })

    await within(chat).findByText('nova')
    expect(log.scrollTop).toBe(layout.bottom())
    expect(within(chat).queryByRole('button', { name: 'New messages' })).not.toBeInTheDocument()
  })

  it('stays put and shows the pill when the reader scrolled up, and the pill jumps down', async () => {
    const { chat, log, layout } = await openLaidOutChat()
    layout.scrollTo(100)

    sendFromServer({ type: 'chat_message', payload: { message: message(7, ANA, 'nova') } })

    const pill = await within(chat).findByRole('button', { name: 'New messages' })
    expect(log.scrollTop).toBe(100)

    await userEvent.click(pill)

    expect(log.scrollTop).toBe(layout.bottom())
    await waitFor(() =>
      expect(within(chat).queryByRole('button', { name: 'New messages' })).not.toBeInTheDocument()
    )
  })

  it('hides the pill once the reader scrolls to the bottom', async () => {
    const { chat, layout } = await openLaidOutChat()
    layout.scrollTo(100)
    sendFromServer({ type: 'chat_message', payload: { message: message(7, ANA, 'nova') } })
    await within(chat).findByRole('button', { name: 'New messages' })

    layout.scrollTo(layout.bottom())

    await waitFor(() =>
      expect(within(chat).queryByRole('button', { name: 'New messages' })).not.toBeInTheDocument()
    )
  })

  it('treats a message dated before the last one, by a clock behind, as a new one', async () => {
    const { chat, log, layout } = await openLaidOutChat()
    const between = (n: number, body: string) => ({
      ...message(n, ANA, body),
      createdAt: new Date(Date.parse(SIX[5]!.createdAt) - 1_000).toISOString(),
    })
    layout.scrollTo(layout.bottom())

    sendFromServer({ type: 'chat_message', payload: { message: between(7, 'atrasada') } })

    await within(chat).findByText('atrasada')
    expect(log.scrollTop).toBe(layout.bottom())

    layout.scrollTo(100)
    sendFromServer({ type: 'chat_message', payload: { message: between(8, 'outra atrasada') } })

    expect(await within(chat).findByRole('button', { name: 'New messages' })).toBeInTheDocument()
    expect(log.scrollTop).toBe(100)
  })

  it('jumps to the bottom when the viewer sends, even scrolled up', async () => {
    onHttp('POST', '/api/rooms/:code/messages', ({ body }) =>
      httpCreated({
        ...(body as object),
        roomCode: CODE,
        createdAt: new Date().toISOString(),
        author: ME,
      })
    )
    const { chat, log, layout } = await openLaidOutChat()
    layout.scrollTo(100)

    await userEvent.type(within(chat).getByRole('textbox', { name: 'Message' }), 'minha{Enter}')

    await within(chat).findByText('minha')
    expect(log.scrollTop).toBe(layout.bottom())
    expect(within(chat).queryByRole('button', { name: 'New messages' })).not.toBeInTheDocument()
  })
})

describe('older history', () => {
  const OLDER = [1, 2, 3].map((n) => message(n, ANA, `antiga ${n}`))
  const NEWER = [4, 5, 6, 7, 8, 9].map((n) => message(n, ANA, `linha ${n}`))

  it('offers a retry when an older page fails, and reads it again on click', async () => {
    let olderReads = 0
    onHttp('GET', '/api/rooms/:code/messages', ({ query }) => {
      if (query.get('before') !== NEWER[0]!.id) return httpOk({ items: NEWER, hasMore: true })
      olderReads += 1
      return olderReads === 1
        ? httpError(500, { error: 'INTERNAL_ERROR', message: 'boom' })
        : httpOk({ items: OLDER, hasMore: false })
    })
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('linha 9')
    const layout = layOut(within(chat).getByRole('log'))

    layout.scrollTo(0)
    expect(await within(chat).findByText('Could not load older messages.')).toBeInTheDocument()
    layout.scrollTo(0)
    expect(olderReads).toBe(1)

    await userEvent.click(within(chat).getByRole('button', { name: 'Try again' }))

    expect(await within(chat).findByText('antiga 1')).toBeInTheDocument()
    expect(within(chat).queryByText('Could not load older messages.')).not.toBeInTheDocument()
    expect(olderReads).toBe(2)
  })

  it('loads at the top and keeps the reader where they were', async () => {
    const older = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/:code/messages', ({ query }) =>
      query.get('before') === NEWER[0]!.id ? older.promise : httpOk({ items: NEWER, hasMore: true })
    )
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('linha 9')
    const log = within(chat).getByRole('log')
    const layout = layOut(log)

    layout.scrollTo(0)

    expect(await within(chat).findByRole('status', { name: 'Loading older messages' })).toBeTruthy()
    await act(async () => {
      older.resolve(httpOk({ items: OLDER, hasMore: false }))
      await older.promise
    })

    await within(chat).findByText('antiga 1')
    // Three rows came in above, so the row the reader saw at the top is now 300px down.
    expect(log.scrollTop).toBe(300)
    expect(within(chat).queryByRole('status', { name: 'Loading older messages' })).toBeNull()

    layout.scrollTo(0)
    expect(getHttpLog().filter((request) => request.query.has('before'))).toHaveLength(1)
  })

  it('keeps the position when a new message also lands below while the page loads', async () => {
    const older = deferred<MockHttpResponse>()
    onHttp('GET', '/api/rooms/:code/messages', ({ query }) =>
      query.get('before') === NEWER[0]!.id ? older.promise : httpOk({ items: NEWER, hasMore: true })
    )
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('linha 9')
    const log = within(chat).getByRole('log')
    const layout = layOut(log)
    layout.scrollTo(0)
    await within(chat).findByRole('status', { name: 'Loading older messages' })

    sendFromServer({ type: 'chat_message', payload: { message: message(10, ANA, 'embaixo') } })
    await within(chat).findByText('embaixo')
    await act(async () => {
      older.resolve(httpOk({ items: OLDER, hasMore: false }))
      await older.promise
    })

    await within(chat).findByText('antiga 1')
    expect(log.scrollTop).toBe(300)
  })
})

describe('the typing signal', () => {
  function typingFrames() {
    return serverSentFrames().filter((frame) => frame.type === 'chat_typing')
  }

  it('sends one signal while the viewer types, however many keys that takes', async () => {
    await openMemberLobby()
    const chat = await openChat()

    await userEvent.type(within(chat).getByRole('textbox', { name: 'Message' }), 'bora jogar')

    expect(typingFrames()).toEqual([{ type: 'chat_typing', payload: { roomCode: CODE } }])
  })

  it('sends nothing for a composer that holds only whitespace', async () => {
    await openMemberLobby()
    const chat = await openChat()

    await userEvent.type(within(chat).getByRole('textbox', { name: 'Message' }), '   ')

    expect(typingFrames()).toEqual([])
  })

  it('sends nothing while the Squad is Ready, which leaves no composer to type in', async () => {
    renderSquadsFlow(`/squads/${CODE}`)
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })
    await screen.findByText('Ana')
    const chat = await openChat()

    expect(within(chat).queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
    expect(typingFrames()).toEqual([])
  })
})

describe('who is typing', () => {
  const BIA = { ...guestPlayer, id: 'user-3', name: 'Bia' }

  /** The member's tile in the members panel; the chat window draws the name too, in its messages. */
  function memberTile(name: string): HTMLElement {
    const tile = screen
      .getAllByText(name)
      .map((element) => element.closest('li'))
      .find((item) => item !== null && item.closest('[role="dialog"]') === null)
    if (!tile) throw new Error(`No tile for ${name}`)
    return tile
  }

  function typing(playerId: string, roomCode = CODE): void {
    sendFromServer({ type: 'chat_typing', payload: { roomCode, playerId } })
  }

  it('draws the dots on the member tile and names them in the footer', async () => {
    await openMemberLobby()
    const chat = await openChat()

    typing(ANA.id)

    expect(await within(chat).findByText('Ana is typing…')).toBeInTheDocument()
    expect(within(memberTile('Ana')).getByTestId('typing-dots')).toBeInTheDocument()
    expect(within(memberTile('Ana')).getByText('Typing')).toHaveClass('sr-only')
    expect(within(memberTile('Caio')).queryByTestId('typing-dots')).not.toBeInTheDocument()
  })

  it('counts several members typing at once', async () => {
    renderSquadsFlow(`/squads/${CODE}`)
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({
      type: 'room_snapshot',
      payload: lobbySnapshot({ players: [hostPlayer, guestPlayer, BIA] }),
    })
    await screen.findByText('Bia')
    const chat = await openChat()

    typing(ANA.id)
    typing(BIA.id)

    expect(await within(chat).findByText('2 people are typing…')).toBeInTheDocument()
    expect(within(memberTile('Bia')).getByTestId('typing-dots')).toBeInTheDocument()
  })

  it('stops showing a member 4 seconds after their last signal', async () => {
    await openMemberLobby()
    const chat = await openChat()
    vi.useFakeTimers()
    try {
      typing(ANA.id)
      act(() => vi.advanceTimersByTime(3_900))
      expect(within(chat).getByText('Ana is typing…')).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(100))

      expect(within(chat).queryByText('Ana is typing…')).not.toBeInTheDocument()
      expect(within(memberTile('Ana')).queryByTestId('typing-dots')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops showing a member as soon as their message arrives', async () => {
    await openMemberLobby()
    const chat = await openChat()
    typing(ANA.id)
    await within(chat).findByText('Ana is typing…')

    sendFromServer({ type: 'chat_message', payload: { message: message(3, ANA, 'cheguei') } })

    await within(chat).findByText('cheguei')
    expect(within(chat).queryByText('Ana is typing…')).not.toBeInTheDocument()
    expect(within(memberTile('Ana')).queryByTestId('typing-dots')).not.toBeInTheDocument()
  })

  it('never shows the viewer own typing, nor typing of another Squad', async () => {
    await openMemberLobby()
    const chat = await openChat()

    typing(ME.id)
    typing(ANA.id, 'OTHER1')

    await act(async () => {})
    expect(within(chat).queryByText(/typing…/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('typing-dots')).not.toBeInTheDocument()
  })

  it('shows nobody typing while the Squad is Ready', async () => {
    renderSquadsFlow(`/squads/${CODE}`)
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })
    await screen.findByText('Ana')
    const chat = await openChat()

    typing(ANA.id)

    await act(async () => {})
    expect(within(chat).queryByText(/typing…/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('typing-dots')).not.toBeInTheDocument()
  })
})

describe('the cooldown', () => {
  const COOLDOWN = /Easy there — send again in (\d+)s/

  function echoSends(): void {
    onHttp('POST', '/api/rooms/:code/messages', ({ body }) =>
      httpCreated({
        ...(body as { id: string; body: string }),
        roomCode: CODE,
        createdAt: new Date().toISOString(),
        author: ME,
      })
    )
  }

  function refuseSends(status: number, body: unknown, headers?: Record<string, string>): void {
    onHttp('POST', '/api/rooms/:code/messages', () => httpError(status, body, headers))
  }

  async function openChatWindow(): Promise<HTMLElement> {
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')
    return chat
  }

  function field(chat: HTMLElement): HTMLElement {
    return within(chat).getByRole('textbox', { name: 'Message' })
  }

  /** Four confirmed sends, then the fifth typed and ready to go. */
  async function typeUpToTheFifth(chat: HTMLElement): Promise<void> {
    for (let n = 1; n <= 4; n++) {
      await userEvent.type(field(chat), `msg ${n}{Enter}`)
      await waitFor(() =>
        expect(within(chat).getByText(`msg ${n}`).closest('li')).not.toHaveAttribute('aria-busy')
      )
    }
    expect(within(chat).queryByText(COOLDOWN)).not.toBeInTheDocument()
    await userEvent.type(field(chat), 'msg 5')
  }

  /** Presses Send under fake timers, so the cooldown it may start is driven by the test's clock. */
  async function sendUnderFakeTimers(chat: HTMLElement): Promise<void> {
    vi.useFakeTimers()
    fireEvent.click(within(chat).getByRole('button', { name: 'Send' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it('starts on the fifth message in a window, before the server has to refuse', async () => {
    echoSends()
    const chat = await openChatWindow()
    await typeUpToTheFifth(chat)
    try {
      await sendUnderFakeTimers(chat)

      expect(within(chat).getByText(COOLDOWN)).toBeInTheDocument()
      fireEvent.change(field(chat), { target: { value: 'msg 6' } })
      expect(within(chat).getByRole('button', { name: 'Send' })).toBeDisabled()
      fireEvent.keyDown(field(chat), { key: 'Enter' })
      expect(countHttpCalls('POST', '/api/rooms/:code/messages')).toBe(5)
      expect(field(chat)).toHaveValue('msg 6')
    } finally {
      vi.useRealTimers()
    }
  })

  it('unlocks by itself once the oldest message of the window has left it', async () => {
    echoSends()
    const chat = await openChatWindow()
    await typeUpToTheFifth(chat)
    try {
      await sendUnderFakeTimers(chat)
      fireEvent.change(field(chat), { target: { value: 'next' } })
      expect(within(chat).getByText(COOLDOWN)).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(10_000))

      expect(within(chat).queryByText(COOLDOWN)).not.toBeInTheDocument()
      expect(within(chat).getByRole('button', { name: 'Send' })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('starts from retryAfterMs when the server refuses with CHAT_RATE_LIMITED', async () => {
    refuseSends(
      429,
      { error: 'CHAT_RATE_LIMITED', message: 'slow down', retryAfterMs: 6_000 },
      { 'Retry-After': '6' }
    )
    const chat = await openChatWindow()
    await userEvent.type(field(chat), 'rápido')
    try {
      await sendUnderFakeTimers(chat)

      expect(within(chat).getByText('Easy there — send again in 6s')).toBeInTheDocument()
      expect(field(chat)).toHaveValue('rápido')
      expect(within(chat).queryByText('rápido', { selector: 'li span' })).not.toBeInTheDocument()
      expect(within(chat).queryByText('Your message was not sent. Try again.')).toBeNull()
      expect(within(chat).getByRole('button', { name: 'Send' })).toBeDisabled()

      act(() => vi.advanceTimersByTime(4_000))
      expect(within(chat).getByText('Easy there — send again in 2s')).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(2_000))
      expect(within(chat).queryByText(COOLDOWN)).not.toBeInTheDocument()
      expect(within(chat).getByRole('button', { name: 'Send' })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('drains the bar with CSS over the cooldown and announces the wait once', async () => {
    refuseSends(429, { error: 'CHAT_RATE_LIMITED', message: 'slow down', retryAfterMs: 6_000 })
    const chat = await openChatWindow()
    await userEvent.type(field(chat), 'rápido')
    try {
      await sendUnderFakeTimers(chat)

      const bar = within(chat).getByTestId('chat-cooldown-bar')
      expect(bar.style.getPropertyValue('--cooldown-duration')).toBe('6000ms')
      expect(bar.style.getPropertyValue('--cooldown-delay')).toBe('0ms')
      const announcement = 'Too many messages in a row. You can send again in 6 seconds.'
      expect(within(chat).getByRole('status')).toHaveTextContent(announcement)

      act(() => vi.advanceTimersByTime(3_000))

      expect(within(chat).getByText('Easy there — send again in 3s')).toBeInTheDocument()
      expect(within(chat).getByTestId('chat-cooldown-bar')).toBe(bar)
      expect(within(chat).getByRole('status')).toHaveTextContent(announcement)

      act(() => vi.advanceTimersByTime(3_000))

      expect(within(chat).queryByTestId('chat-cooldown-bar')).not.toBeInTheDocument()
      expect(within(chat).getByRole('status')).toBeEmptyDOMElement()
    } finally {
      vi.useRealTimers()
    }
  })

  it('starts from Retry-After when the global rate limit refuses', async () => {
    refuseSends(
      429,
      { error: 'RATE_LIMITED', message: 'Too many requests' },
      { 'Retry-After': '3' }
    )
    const chat = await openChatWindow()
    await userEvent.type(field(chat), 'oi')
    try {
      await sendUnderFakeTimers(chat)

      expect(within(chat).getByText('Easy there — send again in 3s')).toBeInTheDocument()
      expect(field(chat)).toHaveValue('oi')
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits 10 seconds when the global rate limit sends no Retry-After', async () => {
    refuseSends(429, { error: 'RATE_LIMITED', message: 'Too many requests' })
    const chat = await openChatWindow()
    await userEvent.type(field(chat), 'oi')
    try {
      await sendUnderFakeTimers(chat)

      expect(within(chat).getByText('Easy there — send again in 10s')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('a Ready Squad chat', () => {
  const READ_ONLY = 'Squad complete'

  async function openChatWindow(): Promise<HTMLElement> {
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')
    return chat
  }

  it('replaces the composer with the banner, history still readable, when the Squad turns Ready', async () => {
    const chat = await openChatWindow()
    expect(within(chat).getByRole('textbox', { name: 'Message' })).toBeInTheDocument()

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await within(chat).findByText(READ_ONLY)).toBeInTheDocument()
    expect(within(chat).queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
    expect(within(chat).queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
    expect(within(chat).getByText('oi time')).toBeInTheDocument()
  })

  it('moves focus to the banner when the Squad turns Ready while the member is typing', async () => {
    const chat = await openChatWindow()
    const field = within(chat).getByRole('textbox', { name: 'Message' })
    act(() => field.focus())
    expect(field).toHaveFocus()

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await within(chat).findByText(READ_ONLY)).toHaveFocus()
  })

  it('leaves focus alone when the Squad turns Ready while the member is elsewhere', async () => {
    const chat = await openChatWindow()
    const field = within(chat).getByRole('textbox', { name: 'Message' })
    act(() => field.focus())
    act(() => field.blur())

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await within(chat).findByText(READ_ONLY)).not.toHaveFocus()
  })

  it('shows the banner when the Squad turned Ready while the window was closed', async () => {
    await openMemberLobby()

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })
    const chat = await openChat()

    expect(await within(chat).findByText(READ_ONLY)).toBeInTheDocument()
    expect(within(chat).queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
    expect(await within(chat).findByText('oi time')).toBeInTheDocument()
  })

  it('drops a running cooldown when the Squad turns Ready', async () => {
    onHttp('POST', '/api/rooms/:code/messages', () =>
      httpError(429, { error: 'CHAT_RATE_LIMITED', message: 'slow', retryAfterMs: 8_000 })
    )
    const chat = await openChatWindow()
    await userEvent.type(within(chat).getByRole('textbox', { name: 'Message' }), 'oi{Enter}')
    expect(await within(chat).findByText(/Easy there — send again in/)).toBeInTheDocument()

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

    expect(await within(chat).findByText(READ_ONLY)).toBeInTheDocument()
    expect(within(chat).queryByText(/Easy there/)).not.toBeInTheDocument()
  })

  it('removes the pending bubble and shows the banner when a send loses the race to Ready', async () => {
    const reply = deferred<MockHttpResponse>()
    onHttp('POST', '/api/rooms/:code/messages', () => reply.promise)
    const chat = await openChatWindow()
    await userEvent.type(within(chat).getByRole('textbox', { name: 'Message' }), 'tarde{Enter}')
    const bubble = await within(chat).findByText('tarde')
    expect(bubble.closest('li')).toHaveAttribute('aria-busy', 'true')

    await act(async () => {
      reply.resolve(httpError(422, { error: 'ROOM_READY', message: 'chat is read-only' }))
      await reply.promise
    })

    expect(await within(chat).findByText(READ_ONLY)).toBeInTheDocument()
    expect(within(chat).queryByText('tarde')).not.toBeInTheDocument()
    expect(within(chat).queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
    expect(within(chat).queryByText('Your message was not sent. Try again.')).toBeNull()
  })
})
