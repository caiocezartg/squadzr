import type { WebSocket } from '@fastify/websocket'
import { describe, expect, it, vi } from 'vitest'
import { WsConnectionManager } from '../ws-connection-manager'
import { handleDisconnect } from './room.handler'

const ROOM_CODE = 'ABC123'

function fakeSocket() {
  const send = vi.fn<(data: string) => void>()
  const socket = { OPEN: 1, readyState: 1, send } as unknown as WebSocket
  return { socket, send }
}

function joinRoom(manager: WsConnectionManager, socket: WebSocket, userId: string): void {
  manager.setClientData(socket, {
    userId,
    userName: userId,
    userImage: null,
    roomCode: ROOM_CODE,
    isInLobby: true,
    send: vi.fn(),
  })
  manager.addToRoom(ROOM_CODE, socket)
  manager.subscribeLobby(socket)
}

describe('handleDisconnect', () => {
  it('broadcasts viewer_left once when both error and close fire for the same socket', () => {
    const manager = new WsConnectionManager()
    const remaining = fakeSocket()
    const leaving = fakeSocket()
    joinRoom(manager, remaining.socket, 'host')
    joinRoom(manager, leaving.socket, 'member')

    handleDisconnect(leaving.socket, manager)
    handleDisconnect(leaving.socket, manager)

    const sent = remaining.send.mock.calls.map(([raw]) => JSON.parse(raw))
    expect(sent).toEqual([
      {
        type: 'viewer_left',
        timestamp: expect.any(Number),
        payload: { playerId: 'member', roomCode: ROOM_CODE },
      },
    ])
    expect(manager.getClientData(leaving.socket)).toMatchObject({
      roomCode: null,
      isInLobby: false,
    })
  })
})
