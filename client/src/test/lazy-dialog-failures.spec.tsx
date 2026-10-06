/**
 * Failed on-demand dialogs (CCC-43 review follow-up).
 *
 * The create and join dialogs are non-essential islands: when their chunk
 * import rejects the dialog disappears, but the page keeps rendering and the
 * failure is surfaced once through `notifyError` with its i18n message instead
 * of the router's default error screen taking over the route.
 */

import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoomsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { catalogGames, catalogRooms } from './fixtures'

const notifyError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/notify', () => ({ notifyError }))

// Both dialog chunks reject in this scene.
vi.mock('@/features/room-creation', () => {
  throw new Error('create dialog chunk failed')
})

vi.mock('@/features/room-joining/join-room-auth-modal', () => {
  throw new Error('join dialog chunk failed')
})

const DIALOG_LOAD_ERROR = 'The dialog failed to load. Please try again.'

beforeEach(() => {
  notifyError.mockClear()
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
  // React logs the errors it catches; the assertions cover the app behaviour.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('failed on-demand dialogs', () => {
  it('keeps the catalog rendered and notifies once when the create dialog chunk fails', async () => {
    // The app entry mounts the tree inside StrictMode; a single failure must
    // still reach the owner exactly once.
    const { user } = renderRoomsFlow('/rooms', { strictMode: true })
    await screen.findByText('Ranked grind')

    await user.click(screen.getByText('Create new squad'))

    await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1))
    expect(notifyError).toHaveBeenCalledWith(DIALOG_LOAD_ERROR)
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
    expect(screen.getByText('Create new squad')).toBeInTheDocument()
  })

  it('keeps the catalog rendered and notifies once when the join prompt chunk fails', async () => {
    const { user } = renderRoomsFlow('/rooms', { user: null })
    await screen.findByText('Ranked grind')

    await user.click(screen.getByText('Ranked grind'))

    await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1))
    expect(notifyError).toHaveBeenCalledWith(DIALOG_LOAD_ERROR)
    expect(screen.getByText('Ranked grind')).toBeInTheDocument()
  })

  it('keeps My squads rendered and notifies once when the create dialog chunk fails', async () => {
    onHttp('GET', '/api/rooms/my', () => httpOk({ hosted: [], joined: [] }))
    const { user } = renderRoomsFlow('/rooms/my')
    await screen.findByText('My squads')

    await user.click(screen.getByText('Create new squad'))

    await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1))
    expect(notifyError).toHaveBeenCalledWith(DIALOG_LOAD_ERROR)
    expect(screen.getByText('My squads')).toBeInTheDocument()
  })
})
