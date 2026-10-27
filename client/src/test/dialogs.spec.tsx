/**
 * The dialogs load with their pages (CCC-81, CCC-82). The create and join dialogs are imported
 * eagerly, so the first open shows the dialog's content at once. Squad creation owns the one create
 * dialog both the Squad Board and My Squads mount.
 */

import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderSquadsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { boardGames, boardSquads } from './fixtures'

beforeEach(() => {
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  // The create dialog's game search: a name filter and a limit, as the catalog contract answers.
  onHttp('GET', '/api/games', (request) => {
    const search = request.query.get('search')?.trim().toLowerCase() ?? ''
    const limit = Number(request.query.get('limit') ?? boardGames.games.length)
    return httpOk({
      games: boardGames.games
        .filter((game) => game.name.toLowerCase().includes(search))
        .slice(0, limit),
    })
  })
})

describe('eager dialogs', () => {
  it('opens the create dialog with its form at once', async () => {
    const { user } = renderSquadsFlow('/squads', { shell: true })
    await screen.findByText('Ranked grind')

    await user.click(screen.getByRole('button', { name: 'Create squad' }))

    expect(await screen.findByText('Create a Squad')).toBeInTheDocument()
    expect(screen.getByLabelText('Squad Name')).toBeInTheDocument()
  })

  it('opens the guest sign-in prompt with its actions at once', async () => {
    const { user } = renderSquadsFlow('/squads', { user: null })
    await screen.findByText('Ranked grind')

    await user.click(screen.getByText('Ranked grind'))

    expect(await screen.findByText('Sign in required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Discord' })).toBeInTheDocument()
  })
})
