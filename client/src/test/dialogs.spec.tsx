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
  onHttp('GET', '/api/games', () => httpOk(boardGames))
  onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [], joined: [] }))
})

describe('eager dialogs', () => {
  it('opens the create dialog with its form at once', async () => {
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText('Ranked grind')

    await user.click(screen.getByText('Create new squad'))

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

  it('opens the My Squads create dialog with its form at once', async () => {
    const { user } = renderSquadsFlow('/squads/my')
    await screen.findByText('My squads')

    await user.click(screen.getByRole('button', { name: 'Create new squad' }))

    expect(await screen.findByText('Create a Squad')).toBeInTheDocument()
    expect(screen.getByLabelText('Squad Name')).toBeInTheDocument()
  })
})
