/**
 * The protocol handshake (CCC-38): when the server announces a different
 * protocol version, the announcement cannot be parsed, or a frame cannot be
 * parsed at all, the client shows a short notice and reloads to fetch the
 * build that matches the server. A payload that only breaks its event contract
 * is rejected without a reload (covered in ws-validators.spec).
 */

import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoomsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { catalogGames, catalogRooms, openRoom } from './fixtures'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import { latestWebSocket } from './ws-mock'
import { REALTIME_UPDATE_NOTICE_ID } from '@/lib/realtime-update'

const originalLocation = window.location

function stubReload(): ReturnType<typeof vi.fn> {
  const reload = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, reload },
    configurable: true,
    writable: true,
  })
  return reload
}

beforeEach(() => {
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  document.getElementById(REALTIME_UPDATE_NOTICE_ID)?.remove()
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    configurable: true,
    writable: true,
  })
  vi.restoreAllMocks()
})

describe('realtime protocol handshake', () => {
  it('shows a notice and reloads when the announced version differs', async () => {
    const reload = stubReload()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)

    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 99 } })

    expect(await screen.findByText('A new version is available. Reloading…')).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows a notice and reloads when the announcement cannot be parsed', async () => {
    const reload = stubReload()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)

    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 'two' } })

    expect(await screen.findByText('A new version is available. Reloading…')).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows a notice and reloads when a frame cannot be parsed at all', async () => {
    const reload = stubReload()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)

    openLatestWebSocket()
    act(() => {
      latestWebSocket().onmessage?.(new MessageEvent('message', { data: '{not json' }))
    })

    expect(await screen.findByText('A new version is available. Reloading…')).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('keeps the matching build running without a notice or reload', async () => {
    const reload = stubReload()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)

    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 2 } })
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: openRoom.id, roomCode: openRoom.code },
    })

    await vi.waitFor(() => expect(screen.queryByText(openRoom.name)).not.toBeInTheDocument())
    expect(reload).not.toHaveBeenCalled()
    expect(screen.queryByText('A new version is available. Reloading…')).not.toBeInTheDocument()
  })
})
