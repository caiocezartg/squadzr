/**
 * The dialogs load with their pages (CCC-81). The create and join dialogs used to be on-demand
 * chunks with a loading fallback; they are imported eagerly now, so the first open shows the dialog's
 * content at once.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderSquadsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { boardGames, boardSquads } from './fixtures'

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function read(path: string): string {
  return readFileSync(resolve(SRC_DIR, path), 'utf8')
}

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

  it('imports the create and join dialogs eagerly, not as lazy chunks', () => {
    const board = read('features/squad-board/squad-board-results.tsx')
    const mySquads = read('features/my-squads/my-squads-results.tsx')
    const joining = read('features/squad-joining/use-squad-joining.tsx')

    expect(board).toContain("from './create-squad-dialog'")
    expect(mySquads).toContain("from '@/features/room-creation'")
    expect(joining).toContain("from './join-squad-auth-modal'")

    for (const source of [board, mySquads, joining]) {
      expect(source).not.toMatch(/\blazy\(|LazyIslandBoundary|ModalLoading/)
    }
  })
})
