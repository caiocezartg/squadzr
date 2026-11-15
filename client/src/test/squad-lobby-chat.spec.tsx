/**
 * The Squad chat in the Lobby: the history of the join, live messages, sending through the channel, and the
 * field closed until the channel has sent its snapshot.
 */

import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ChatMessageDto } from '@squadzr/schemas/ws'
import { renderSquadsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { boardSquads, guestPlayer, hostPlayer, lobbySquadResponse, lobbySnapshot } from './fixtures'
import { openLatestWebSocket, sendFromServer, serverSentFrames } from './ws-flows'

function chatMessage(overrides: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id: 'message-1',
    authorId: guestPlayer.id,
    authorName: guestPlayer.name,
    authorImage: guestPlayer.image,
    body: 'bora?',
    sentAt: '2026-11-15T12:00:00.000Z',
    ...overrides,
  }
}

async function renderJoinedLobby() {
  const flow = renderSquadsFlow('/squads/LOBBY1')
  await screen.findByText('Squad ready check')
  openLatestWebSocket()
  sendFromServer({ type: 'room_snapshot', payload: lobbySnapshot() })
  await screen.findByText('Ana')
  return flow
}

function chatLog(): HTMLElement {
  return screen.getByRole('log', { name: 'Squad messages' })
}

beforeEach(() => {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))
})

describe('squad lobby — chat', () => {
  it('keeps the field closed until the channel has sent its snapshot', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')

    expect(screen.getByRole('textbox', { name: 'Message to the squad' })).toBeDisabled()
    expect(within(chatLog()).getByText('No messages yet. Plan the match here.')).toBeVisible()
  })

  it('shows the history of the join, and a repeated history adds nothing', async () => {
    await renderJoinedLobby()
    const history = {
      roomCode: 'LOBBY1',
      messages: [
        chatMessage(),
        chatMessage({ id: 'message-2', authorId: hostPlayer.id, authorName: 'Caio', body: 'bora' }),
      ],
    }

    sendFromServer({ type: 'chat_history', payload: history })
    sendFromServer({ type: 'chat_history', payload: history })

    expect(await within(chatLog()).findByText('bora?')).toBeInTheDocument()
    expect(within(chatLog()).getAllByRole('article')).toHaveLength(2)
  })

  it('sends a trimmed message through the channel and shows it when the server sends it back', async () => {
    const { user } = await renderJoinedLobby()
    const field = screen.getByRole('textbox', { name: 'Message to the squad' })

    await user.type(field, '  partiu  {Enter}')

    await waitFor(() =>
      expect(serverSentFrames()).toContainEqual(
        expect.objectContaining({
          type: 'chat_send',
          payload: { roomCode: 'LOBBY1', body: 'partiu' },
        })
      )
    )
    expect(field).toHaveValue('')
    expect(within(chatLog()).queryByText('partiu')).not.toBeInTheDocument()

    sendFromServer({
      type: 'chat_message',
      payload: {
        roomCode: 'LOBBY1',
        message: chatMessage({ authorId: hostPlayer.id, authorName: 'Caio', body: 'partiu' }),
      },
    })

    expect(await within(chatLog()).findByText('partiu')).toBeInTheDocument()
  })

  it('does not send a message of spaces', async () => {
    const { user } = await renderJoinedLobby()

    await user.type(screen.getByRole('textbox', { name: 'Message to the squad' }), '   {Enter}')

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(serverSentFrames().some((frame) => frame.type === 'chat_send')).toBe(false)
  })

  it('ignores messages of another Squad', async () => {
    await renderJoinedLobby()

    sendFromServer({
      type: 'chat_message',
      payload: { roomCode: 'OTHER1', message: chatMessage({ body: 'elsewhere' }) },
    })
    sendFromServer({
      type: 'chat_message',
      payload: { roomCode: 'LOBBY1', message: chatMessage() },
    })

    expect(await within(chatLog()).findByText('bora?')).toBeInTheDocument()
    expect(within(chatLog()).queryByText('elsewhere')).not.toBeInTheDocument()
  })
})
