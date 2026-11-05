import type { WebSocket } from '@fastify/websocket'
import { describe, expect, it, vi } from 'vitest'
import { WsConnectionManager } from './ws-connection-manager'

// #118: the user page asks the connection registry whether a person is online.

function fakeSocket(): WebSocket {
  return { OPEN: 1, readyState: 1, send: vi.fn() } as unknown as WebSocket
}

function connectedAs(manager: WsConnectionManager, userId: string | null): WebSocket {
  const socket = fakeSocket()
  manager.setClientData(socket, {
    userId,
    sessionId: null,
    userName: null,
    userImage: null,
    roomCode: null,
    isInLobby: false,
    send: vi.fn(),
  })
  if (userId) manager.addUserSocket(userId, socket)
  return socket
}

describe('WsConnectionManager online presence', () => {
  it('knows nobody is online before anyone connects', () => {
    const manager = new WsConnectionManager()

    expect(manager.isUserOnline('user-1')).toBe(false)
    expect(manager.countOnlineUsers()).toBe(0)
  })

  it('has a signed-in user online while at least one of their sockets is open', () => {
    const manager = new WsConnectionManager()
    const first = connectedAs(manager, 'user-1')
    const second = connectedAs(manager, 'user-1')

    expect(manager.isUserOnline('user-1')).toBe(true)

    manager.disconnect(first)
    expect(manager.isUserOnline('user-1')).toBe(true)

    manager.disconnect(second)
    expect(manager.isUserOnline('user-1')).toBe(false)
  })

  it('counts a user once however many sockets they hold, and ignores guests', () => {
    const manager = new WsConnectionManager()
    connectedAs(manager, 'user-1')
    connectedAs(manager, 'user-1')
    connectedAs(manager, 'user-2')
    connectedAs(manager, null)

    expect(manager.countOnlineUsers()).toBe(2)
    expect(manager.isUserOnline('user-3')).toBe(false)
  })
})
