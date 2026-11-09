/**
 * One game's page in the admin Catalog (#122): every field, the IGDB link only for a game with an IGDB
 * id, the usage, the Open Squads linked to their side panel on the Squads page, a game the catalog does
 * not hold, and a cached game that renders with no loading state.
 */

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AdminGameDetailResponse, AdminSquadDto } from '@squadzr/schemas'
import { createTestQueryClient } from '@/test/harness'
import { httpError, httpOk, onHttp } from '@/test/http-router'
import { EnglishIntlProvider } from '@/test/intl'
import { createHarnessNavigation } from '@/test/navigation'
import { AdminGamePage } from './admin-game-page'
import { adminGameQueryKey } from './games-query'

const GAME_ID = '7f1c2a4e-5b6d-4c8e-9f0a-1b2c3d4e5f60'
const SQUAD_ID = '5d9e2f4a-6b7c-4d8e-9f0a-1b2c3d4e5f61'

const squad: AdminSquadDto = {
  id: SQUAD_ID,
  code: 'VLR7K2',
  name: 'Ranked 5x5',
  game: { id: GAME_ID, name: 'Valorant', coverThumbUrl: 'https://images.test/valorant-thumb.jpg' },
  platform: 'pc',
  host: { id: 'user-marina', name: 'Marina Rocha' },
  memberCount: 4,
  maxPlayers: 5,
  createdAt: '2026-11-08T20:00:00.000Z',
  lastActivityAt: '2026-11-08T20:10:00.000Z',
}

function detail(overrides: Partial<AdminGameDetailResponse['game']> = {}): AdminGameDetailResponse {
  return {
    game: {
      id: GAME_ID,
      name: 'Valorant',
      slug: 'valorant',
      coverThumbUrl: 'https://images.test/valorant-thumb.jpg',
      coverUrl: 'https://images.test/valorant.jpg',
      platforms: ['pc'],
      minPlayers: 2,
      maxPlayers: 5,
      popularity: 9120,
      featuredRank: 1,
      listed: true,
      usage: { openSquads: 1, completedSquads: 340 },
      igdbId: 126459,
      genres: [{ slug: 'shooter', name: 'Shooter' }],
      aliases: ['valo'],
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-11-08T04:03:12.000Z',
      ...overrides,
    },
    openSquads: [squad],
  }
}

function renderGame(queryClient: QueryClient = createTestQueryClient()) {
  createHarnessNavigation(`/admin/catalog/games/${GAME_ID}`)
  render(
    <EnglishIntlProvider>
      <QueryClientProvider client={queryClient}>
        <AdminGamePage id={GAME_ID} />
      </QueryClientProvider>
    </EnglishIntlProvider>
  )
}

const field = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling

describe('admin catalog game page', () => {
  it('shows every field, the badges and the usage', async () => {
    onHttp('GET', '/api/admin/catalog/games/:id', () => httpOk(detail()))
    renderGame()

    expect(await screen.findByRole('heading', { level: 1, name: 'Valorant' })).toBeVisible()
    expect(screen.getByText('Listed')).toBeVisible()
    expect(screen.getByText('Featured #1')).toBeVisible()
    expect(field('Aliases')).toHaveTextContent('valo')
    expect(field('Genres')).toHaveTextContent('Shooter')
    expect(field('Platforms')).toHaveTextContent('PC')
    expect(field('Players')).toHaveTextContent('2–5')
    expect(field('Popularity')).toHaveTextContent('9,120')
    expect(field('Featured rank')).toHaveTextContent('#1')
    expect(field('Slug')).toHaveTextContent('valorant')
    expect(field('Created')).not.toHaveTextContent('None')
    expect(screen.getByRole('link', { name: /126459/ })).toHaveAttribute(
      'href',
      'https://www.igdb.com/games/valorant'
    )
    const usage = screen.getByLabelText('Usage')
    expect(usage).toHaveTextContent('Open Squads1')
    expect(usage).toHaveTextContent('Completed Squads340')
  })

  it('shows no IGDB link, and dashes, for a game without them', async () => {
    onHttp('GET', '/api/admin/catalog/games/:id', () =>
      httpOk(detail({ igdbId: null, aliases: [], featuredRank: null, listed: false }))
    )
    renderGame()

    await screen.findByRole('heading', { level: 1, name: 'Valorant' })
    expect(screen.queryByRole('link', { name: /IGDB/ })).not.toBeInTheDocument()
    expect(field('IGDB id')).toHaveTextContent('None')
    expect(field('Aliases')).toHaveTextContent('None')
    expect(screen.getByText('Delisted')).toBeVisible()
    expect(screen.queryByText(/^Featured #/)).not.toBeInTheDocument()
  })

  it('links each Open Squad to its side panel on the Squads page', async () => {
    onHttp('GET', '/api/admin/catalog/games/:id', () => httpOk(detail()))
    renderGame()

    const section = await screen.findByRole('region', { name: 'Open Squads' })
    expect(within(section).getByRole('link', { name: /Ranked 5x5/ })).toHaveAttribute(
      'href',
      `/admin/squads?squad=${SQUAD_ID}`
    )
    expect(section).not.toHaveTextContent('Showing the newest')
  })

  it('says how many it shows when the game has more Open Squads, and leads to all of them', async () => {
    onHttp('GET', '/api/admin/catalog/games/:id', () =>
      httpOk(detail({ usage: { openSquads: 45, completedSquads: 340 } }))
    )
    renderGame()

    const section = await screen.findByRole('region', { name: 'Open Squads' })
    expect(section).toHaveTextContent('Showing the newest 1 of 45.')
    expect(within(section).getByRole('link', { name: 'View all in Squads' })).toHaveAttribute(
      'href',
      `/admin/squads?gameId=${GAME_ID}`
    )
  })

  it('says so when the game has no Open Squad', async () => {
    onHttp('GET', '/api/admin/catalog/games/:id', () =>
      httpOk({ ...detail({ usage: { openSquads: 0, completedSquads: 0 } }), openSquads: [] })
    )
    renderGame()

    expect(await screen.findByText('No open Squad for this game right now.')).toBeVisible()
  })

  it('says so when the catalog has no such game', async () => {
    onHttp('GET', '/api/admin/catalog/games/:id', () =>
      httpError(404, { error: 'GAME_NOT_FOUND', message: 'Game not found' })
    )
    renderGame()

    expect(await screen.findByRole('heading', { level: 1, name: 'Game not found' })).toBeVisible()
    expect(screen.getAllByRole('link', { name: 'Back to Games' })[0]).toHaveAttribute(
      'href',
      '/admin/catalog'
    )
  })

  it('renders a cached game at once, with no loading state', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(adminGameQueryKey(GAME_ID), detail())

    renderGame(queryClient)

    expect(screen.getByRole('heading', { level: 1, name: 'Valorant' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading the game' })).not.toBeInTheDocument()
  })
})
