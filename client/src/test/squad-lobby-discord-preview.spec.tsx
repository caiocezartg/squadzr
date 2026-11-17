/**
 * The Discord server behind a Ready Squad's invite (CCC-112). The API reads it from Discord; the Ready panel
 * shows its icon, name and counts, and falls back to the Squad's own cover, name and counts whenever the
 * API has nothing: no preview, a failed request, a server that answers an invalid one.
 */

import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DiscordPreviewResponse } from '@squadzr/schemas'
import { boardSquads, lobbySquad, lobbySquadResponse, readyLobbySnapshot } from './fixtures'
import { createTestQueryClient, renderSquadsFlow } from './harness'
import { countHttpCalls, httpError, httpOk, onHttp, type MockHttpResponse } from './http-router'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import { discordPreviewQueryKey } from '@/features/lobby/use-discord-preview'

const SERVER: DiscordPreviewResponse = {
  preview: {
    name: 'Premier Qui',
    iconUrl: 'https://cdn.discordapp.com/icons/1/abc.png?size=128',
    backdropUrl: 'https://cdn.discordapp.com/banners/1/def.png?size=480',
    memberCount: 2_946_792,
    onlineCount: 362_025,
  },
}

function serve(answer: () => MockHttpResponse | Promise<MockHttpResponse>): void {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/rooms/:code', () => httpOk(lobbySquadResponse))
  onHttp('GET', '/api/rooms/:code/discord-preview', answer)
}

/** Opens the Lobby and lets the snapshot complete the Squad. */
async function openReadyLobby(
  options: Parameters<typeof renderSquadsFlow>[1] = {},
  snapshot = readyLobbySnapshot()
) {
  const flow = renderSquadsFlow('/squads/LOBBY1', options)
  await screen.findByText('Squad ready check')
  openLatestWebSocket()
  sendFromServer({ type: 'room_snapshot', payload: snapshot })

  const heading = await screen.findByRole('heading', { name: "Let's go to Discord" })
  const panel = heading.closest('section')
  if (!panel) throw new Error('The Ready panel is not a section')
  return { ...flow, panel }
}

/** The counts the panel used to show, which the call line replaced. */
function expectNoStats(panel: HTMLElement): void {
  for (const label of ['online', 'members', 'in the room now', 'players']) {
    expect(within(panel).queryByText(label)).not.toBeInTheDocument()
  }
  expect(within(panel).queryByRole('definition')).not.toBeInTheDocument()
}

/** The images the Ready panel draws: the backdrop, then the icon. */
function panelImages(panel: HTMLElement): string[] {
  return Array.from(panel.querySelectorAll('img'), (image) => image.getAttribute('src') ?? '')
}

beforeEach(() => {
  serve(() => httpOk(SERVER))
})

describe('squad lobby — Discord server preview', () => {
  it('shows the Discord server: its icon and name, with the call to join instead of the counts', async () => {
    const { panel } = await openReadyLobby()

    expect(await within(panel).findByText('Premier Qui')).toBeInTheDocument()
    expect(within(panel).queryByText('Squad ready check')).not.toBeInTheDocument()
    expect(within(panel).getByText('Join the call')).toBeInTheDocument()
    expect(within(panel).getByText('Squad call')).toBeInTheDocument()
    expectNoStats(panel)
    expect(panelImages(panel)).toEqual([
      'https://cdn.discordapp.com/banners/1/def.png?size=480',
      'https://cdn.discordapp.com/icons/1/abc.png?size=128',
    ])
    // The invite itself and its two actions are the same as without the preview.
    expect(within(panel).getByText('discord.gg/')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Open in Discord' })).toHaveAttribute(
      'href',
      'https://discord.gg/lobby'
    )
    expect(within(panel).getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('asks the API for the preview of this Squad only once it is Ready', async () => {
    const flow = renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()
    expect(countHttpCalls('GET', '/api/rooms/:code/discord-preview')).toBe(0)

    sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })
    await screen.findByRole('heading', { name: "Let's go to Discord" })

    await waitFor(() => expect(countHttpCalls('GET', '/api/rooms/:code/discord-preview')).toBe(1))
    flow.unmount()
  })

  it('holds the card with a skeleton while the first read is on its way, then fills it', async () => {
    let answer: (response: MockHttpResponse) => void = () => undefined
    serve(() => new Promise<MockHttpResponse>((resolve) => (answer = resolve)))

    const { panel } = await openReadyLobby()

    // The structure is already there: the label, the invite and its actions. The Squad's name is not
    // shown yet, and nothing says "0".
    expect(within(panel).getByText('SERVER INVITE')).toBeInTheDocument()
    expect(within(panel).queryByText('Squad ready check')).not.toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Open in Discord' })).toBeVisible()
    // The call comes from the Lobby, so it is there before the preview is, with no skeleton.
    expect(within(panel).getByText('Join the call')).toBeInTheDocument()
    expect(within(panel).getByText('Squad call')).toBeInTheDocument()

    answer(httpOk(SERVER))

    expect(await within(panel).findByText('Premier Qui')).toBeInTheDocument()
  })

  it('shows no skeleton when the cache already holds the preview', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(discordPreviewQueryKey('LOBBY1'), SERVER)
    serve(() => new Promise<MockHttpResponse>(() => undefined))

    const { panel } = await openReadyLobby({ queryClient })

    expect(within(panel).getByText('Premier Qui')).toBeInTheDocument()
    expect(within(panel).getByText('Squad call')).toBeInTheDocument()
  })

  it.each<[string, () => MockHttpResponse]>([
    [
      'the API has no preview (an invalid, expired or rate limited invite)',
      () => httpOk({ preview: null }),
    ],
    ['the request fails', () => httpError(500, { error: 'INTERNAL', message: 'Unavailable' })],
    ['the answer is not the contract', () => httpOk({ unexpected: true })],
  ])('falls back to the Squad cover and name, and keeps the call, when %s', async (_, answer) => {
    serve(answer)

    const { panel } = await openReadyLobby()

    expect(await within(panel).findByText('Squad ready check')).toBeInTheDocument()
    expect(within(panel).getByText('Squad call')).toBeInTheDocument()
    expectNoStats(panel)
    expect(panelImages(panel)).toEqual([lobbySquad.game.coverUrl])
    expect(within(panel).getByRole('link', { name: 'Open in Discord' })).toBeVisible()
  })

  it('names the call with its emoji and symbols as plain text, truncated when long', async () => {
    const callName = '》🐂┃NELORE'
    const base = readyLobbySnapshot()
    const { panel } = await openReadyLobby(
      {},
      { ...base, room: { ...base.room, discordCall: { name: callName } } }
    )

    expect(within(panel).getByText(callName)).toHaveClass('truncate')
  })

  it('shows the server card without a call line when the Squad has no Voice Call', async () => {
    const base = readyLobbySnapshot()
    const { panel } = await openReadyLobby(
      {},
      { ...base, room: { ...base.room, discordCall: null } }
    )

    expect(await within(panel).findByText('Premier Qui')).toBeInTheDocument()
    expect(within(panel).queryByText('Join the call')).not.toBeInTheDocument()
    expectNoStats(panel)
    expect(within(panel).getByRole('link', { name: 'Open in Discord' })).toBeVisible()
    expect(within(panel).getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('never reads the preview of a Squad that is still forming', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    expect(await screen.findByRole('region', { name: 'Discord invite' })).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/:code/discord-preview')).toBe(0)
  })
})
