/**
 * Flow tests of the Squad Chat in the Lobby: the launcher only for members, the non-modal window and its
 * focus, the history laid out left and right, the optimistic send, a failed send, and links.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ChatMessageDto } from '@squadzr/schemas'
import { NARROW_QUERY } from '@/components/ds/use-media-query'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import {
  countHttpCalls,
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
  lobbySquad,
  lobbySquadResponse,
} from './fixtures'
import { mockMediaQuery } from './media-query'
import { openLatestWebSocket, sendFromServer } from './ws-flows'

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
    expect(within(chat).getByText('2 members')).toBeInTheDocument()
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
    expect(within(mine.closest('[data-own]') as HTMLElement).getByText('You')).toBeInTheDocument()
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

  it('reads the history again when the window reopens', async () => {
    await openMemberLobby()
    const chat = await openChat()
    await within(chat).findByText('oi time')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    registerRoutes([...HISTORY, message(3, ANA, 'cheguei')])

    const reopened = await openChat()

    expect(await within(reopened).findByText('cheguei')).toBeInTheDocument()
  })

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
