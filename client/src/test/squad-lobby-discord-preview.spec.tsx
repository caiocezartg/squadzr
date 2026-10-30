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
async function openReadyLobby(options: Parameters<typeof renderSquadsFlow>[1] = {}) {
  const flow = renderSquadsFlow('/squads/LOBBY1', options)
  await screen.findByText('Squad ready check')
  openLatestWebSocket()
  sendFromServer({ type: 'room_snapshot', payload: readyLobbySnapshot() })

  const heading = await screen.findByRole('heading', { name: "Let's go to Discord" })
  const panel = heading.closest('section')
  if (!panel) throw new Error('The Ready panel is not a section')
  return { ...flow, panel }
}

/** The number of a count in the server card, by what it counts. */
function statValue(panel: HTMLElement, label: string): HTMLElement {
  const value = within(panel).getByText(label).closest('dt')?.nextElementSibling
  if (!(value instanceof HTMLElement)) throw new Error(`${label} has no value`)
  return value
}

/** The images the Ready panel draws: the backdrop, then the icon. */
function panelImages(panel: HTMLElement): string[] {
  return Array.from(panel.querySelectorAll('img'), (image) => image.getAttribute('src') ?? '')
}

beforeEach(() => {
  serve(() => httpOk(SERVER))
})

describe('squad lobby — Discord server preview', () => {
  it('shows the Discord server: its icon, name and real counts, with the Squad in the room', async () => {
    const { panel } = await openReadyLobby()

    expect(await within(panel).findByText('Premier Qui')).toBeInTheDocument()
    expect(within(panel).queryByText('Squad ready check')).not.toBeInTheDocument()
    expect(statValue(panel, 'online')).toHaveTextContent('362K')
    expect(statValue(panel, 'members')).toHaveTextContent('2.9M')
    expect(statValue(panel, 'in the room now')).toHaveTextContent('2')
    expect(within(panel).queryByText('players')).not.toBeInTheDocument()
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
    expect(within(panel).queryByRole('definition')).not.toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Open in Discord' })).toBeVisible()

    answer(httpOk(SERVER))

    expect(await within(panel).findByText('Premier Qui')).toBeInTheDocument()
  })

  it('shows no skeleton when the cache already holds the preview', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(discordPreviewQueryKey('LOBBY1'), SERVER)
    serve(() => new Promise<MockHttpResponse>(() => undefined))

    const { panel } = await openReadyLobby({ queryClient })

    expect(within(panel).getByText('Premier Qui')).toBeInTheDocument()
    expect(statValue(panel, 'online')).toHaveTextContent('362K')
  })

  it.each<[string, () => MockHttpResponse]>([
    [
      'the API has no preview (an invalid, expired or rate limited invite)',
      () => httpOk({ preview: null }),
    ],
    ['the request fails', () => httpError(500, { error: 'INTERNAL', message: 'Unavailable' })],
    ['the answer is not the contract', () => httpOk({ unexpected: true })],
  ])('falls back to the Squad cover, name and counts when %s', async (_, answer) => {
    serve(answer)

    const { panel } = await openReadyLobby()

    expect(await within(panel).findByText('Squad ready check')).toBeInTheDocument()
    expect(statValue(panel, 'in the room now')).toHaveTextContent('2')
    expect(statValue(panel, 'players')).toHaveTextContent('2')
    expect(panelImages(panel)).toEqual([lobbySquad.game.coverUrl])
    expect(within(panel).queryByText('online')).not.toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Open in Discord' })).toBeVisible()
  })

  it('never reads the preview of a Squad that is still forming', async () => {
    renderSquadsFlow('/squads/LOBBY1')
    await screen.findByText('Squad ready check')
    openLatestWebSocket()

    expect(await screen.findByRole('region', { name: 'Discord invite' })).toBeInTheDocument()
    expect(countHttpCalls('GET', '/api/rooms/:code/discord-preview')).toBe(0)
  })
})
