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
import { renderSquadsFlow } from './harness'
import { httpOk, onHttp } from './http-router'
import { boardGames, boardSquads, openSquad } from './fixtures'
import { openLatestWebSocket, sendFromServer } from './ws-flows'
import { latestWebSocket } from './ws-mock'
import { REALTIME_RELOAD_ATTEMPT_KEY } from '@/lib/realtime-update'
import { setRealtimeUpdateNotice } from '@/lib/realtime-update-store'

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
  onHttp('GET', '/api/rooms', () => httpOk(boardSquads))
  onHttp('GET', '/api/games', () => httpOk(boardGames))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.stubGlobal('sessionStorage', realSessionStorage)
  act(() => setRealtimeUpdateNotice(null))
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
    renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)

    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 99 } })

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(RELOADING_NOTICE)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows a notice and reloads when the announcement cannot be parsed', async () => {
    const reload = stubReload()
    renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)

    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 'two' } })

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows a notice and reloads when a frame cannot be parsed at all', async () => {
    const reload = stubReload()
    renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)

    sendUnparseableFrame()

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('keeps the matching build running without a notice or reload', async () => {
    const reload = stubReload()
    const serverRooms = { rooms: [...boardSquads.rooms] }
    onHttp('GET', '/api/rooms', () => httpOk(serverRooms))
    renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)

    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 2 } })
    serverRooms.rooms = serverRooms.rooms.filter((room) => room.id !== openSquad.id)
    sendFromServer({
      type: 'room_removed',
      payload: { roomId: openSquad.id, roomCode: openSquad.code },
    })

    await vi.waitFor(() => expect(screen.queryByText(openSquad.name)).not.toBeInTheDocument())
    expect(reload).not.toHaveBeenCalled()
    expect(screen.queryByText(RELOADING_NOTICE)).not.toBeInTheDocument()
  })
})

describe('realtime protocol reload bound', () => {
  it('does not reload again when the version diverges after the reload', async () => {
    const reload = stubReload()
    renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)
    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 99 } })

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)

    // The reload tears the page down and mounts it again in the same tab, but
    // the server still announces the other version. sessionStorage remembers
    // the attempt, so the client must not loop.
    cleanup()
    act(() => setRealtimeUpdateNotice(null))
    renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)
    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 99 } })

    expect(await screen.findByText(MANUAL_RELOAD_NOTICE)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MANUAL_RELOAD_NOTICE)
    expect(screen.queryByText(RELOADING_NOTICE)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again when an unparseable frame repeats after the reload', async () => {
    const reload = stubReload()
    renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)
    sendUnparseableFrame()

    expect(await screen.findByText(RELOADING_NOTICE)).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)

    cleanup()
    act(() => setRealtimeUpdateNotice(null))
    renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)
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

    renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)
    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 99 } })

    expect(await screen.findByText(MANUAL_RELOAD_NOTICE)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads from the manual notice button', async () => {
    const reload = stubReload()
    window.sessionStorage.setItem(REALTIME_RELOAD_ATTEMPT_KEY, String(Date.now()))
    const { user } = renderSquadsFlow('/squads')
    await screen.findByText(openSquad.name)
    openLatestWebSocket()
    sendFromServer({ type: 'protocol', payload: { version: 99 } })

    await user.click(await screen.findByRole('button', { name: 'Reload' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })
})
