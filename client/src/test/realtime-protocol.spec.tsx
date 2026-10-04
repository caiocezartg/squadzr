/**
 * The protocol handshake (CCC-38): when the server announces a different
 * protocol version, the announcement cannot be parsed, or a frame cannot be
 * parsed at all, the client shows a short notice and reloads to fetch the
 * build that matches the server. The reload is bounded: a divergence that
 * repeats after the reload keeps a persistent notice with a manual reload
 * instead of looping. A payload that only breaks its event contract is
 * rejected without a reload (covered in ws-validators.spec).
 */

import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoomsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { catalogGames, catalogRooms, openRoom } from './fixtures'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import { latestWebSocket } from './ws-mock'
import { REALTIME_UPDATE_NOTICE_ID } from '@/lib/realtime-update'

const originalLocation = window.location
const realSessionStorage = window.sessionStorage
const RELOADING_NOTICE = 'A new version is available. Reloading…'
const MANUAL_RELOAD_NOTICE = 'A new version is available. Reload the page to update.'

function stubReload(): ReturnType<typeof vi.fn> {
  const reload = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, reload },
    configurable: true,
    writable: true,
  })
  return reload
}

/** Opens the socket and feeds it a frame that cannot be parsed at all. */
function sendUnparseableFrame(): void {
  openLatestWebSocket()
  act(() => {
    latestWebSocket().onmessage?.(new MessageEvent('message', { data: '{not json' }))
  })
}

beforeEach(() => {
  window.sessionStorage.clear()
  onHttp('GET', '/api/rooms', () => httpOk(catalogRooms))
  onHttp('GET', '/api/games', () => httpOk(catalogGames))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.stubGlobal('sessionStorage', realSessionStorage)
  document.getElementById(REALTIME_UPDATE_NOTICE_ID)?.remove()
  window.sessionStorage.clear()
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

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows a notice and reloads when the announcement cannot be parsed', async () => {
    const reload = stubReload()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)

    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 'two' } })

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows a notice and reloads when a frame cannot be parsed at all', async () => {
    const reload = stubReload()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)

    sendUnparseableFrame()

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
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
    expect(screen.queryByText(RELOADING_NOTICE)).not.toBeInTheDocument()
  })
})

describe('realtime protocol reload bound', () => {
  it('does not reload again when the version diverges after the reload', async () => {
    const reload = stubReload()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)
    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 99 } })

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)

    // The reload tears the page down and mounts it again in the same tab, but
    // the server still announces the other version. sessionStorage remembers
    // the attempt, so the client must not loop.
    cleanup()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)
    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 99 } })

    expect(await screen.findByText(MANUAL_RELOAD_NOTICE)).toBeInTheDocument()
    expect(screen.queryByText(RELOADING_NOTICE)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again when an unparseable frame repeats after the reload', async () => {
    const reload = stubReload()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)
    sendUnparseableFrame()

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)

    cleanup()
    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)
    sendUnparseableFrame()

    expect(await screen.findByText(MANUAL_RELOAD_NOTICE)).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never reloads automatically when sessionStorage is unavailable', async () => {
    const reload = stubReload()
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new DOMException('Storage disabled', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('Storage disabled', 'SecurityError')
      },
    })

    renderRoomsFlow('/rooms')
    await screen.findByText(openRoom.name)
    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 99 } })

    expect(await screen.findByText(MANUAL_RELOAD_NOTICE)).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })
})
