/**
 * Dialog loading fallbacks (CCC-43 follow-up).
 *
 * The create and join dialogs are on-demand capabilities: while their chunks
 * are in flight the page shows the ModalLoading fallback, then the real
 * dialog. The imports are held on a gate so the fallback is observable.
 */

import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RoomCreationModule from '@/features/room-creation'
import type * as JoinRoomAuthModalModule from '@/features/room-joining/join-room-auth-modal'
import { renderRoomsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { catalogGames, catalogRooms } from './fixtures'

const gates = vi.hoisted(() => {
  let resolveCreate!: () => void
  let resolveJoin!: () => void

  return {
    create: new Promise<void>((resolve) => {
      resolveCreate = resolve
    }),
    join: new Promise<void>((resolve) => {
      resolveJoin = resolve
    }),
    openCreate: () => resolveCreate(),
    openJoin: () => resolveJoin(),
  }
})

vi.mock('@/features/room-creation', async (importOriginal) => {
  await gates.create
  return await importOriginal<typeof RoomCreationModule>()
})

vi.mock('@/features/room-joining/join-room-auth-modal', async (importOriginal) => {
  await gates.join
  return await importOriginal<typeof JoinRoomAuthModalModule>()
})

beforeEach(() => {
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
})

describe('on-demand dialogs', () => {
  it('shows ModalLoading while the create dialog chunk is in flight', async () => {
    const { user } = renderRoomsFlow('/rooms')
    await screen.findByText('Ranked grind')

    await user.click(screen.getByText('Create new squad'))

    expect(await screen.findByTestId('modal-loading')).toBeInTheDocument()
    expect(screen.queryByText('Create a Squad')).not.toBeInTheDocument()

    await act(async () => {
      gates.openCreate()
    })

    expect(await screen.findByText('Create a Squad')).toBeInTheDocument()
    expect(screen.queryByTestId('modal-loading')).not.toBeInTheDocument()
  })

  it('shows ModalLoading while the join prompt chunk is in flight', async () => {
    const { user } = renderRoomsFlow('/rooms', { user: null })
    await screen.findByText('Ranked grind')

    await user.click(screen.getByText('Ranked grind'))

    expect(await screen.findByTestId('modal-loading')).toBeInTheDocument()
    expect(screen.queryByText('Sign in required')).not.toBeInTheDocument()

    await act(async () => {
      gates.openJoin()
    })

    expect(await screen.findByText('Sign in required')).toBeInTheDocument()
    expect(screen.queryByTestId('modal-loading')).not.toBeInTheDocument()
  })
})
