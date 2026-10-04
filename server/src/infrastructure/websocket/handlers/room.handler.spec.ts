import type { WebSocket } from '@fastify/websocket'
import { describe, expect, it, vi } from 'vitest'
import { WsConnectionManager } from '../ws-connection-manager'
import { handleDisconnect, handleJoinRoom } from './room.handler'
import type {
  IGetRealtimeSnapshotUseCase,
  RealtimeSnapshot,
} from '@application/use-cases/room/get-realtime-snapshot.use-case'
import type { WsRoomBroadcaster } from '../room-broadcaster.service'
import { createMockRoom } from '@test/mocks'
import { Presence } from '../presence'
import { FakeClock } from '@test/harness/clock'

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
  it('schedules offline once when both error and close fire for the same socket', () => {
    const manager = new WsConnectionManager()
    const remaining = fakeSocket()
    const leaving = fakeSocket()
    joinRoom(manager, remaining.socket, 'host')
    joinRoom(manager, leaving.socket, 'member')

    const clock = new FakeClock(new Date('2026-01-01'))
    const transition = vi.fn()
    const presence = new Presence(clock, transition)
    presence.join(ROOM_CODE, 'member', leaving.socket)
    handleDisconnect(leaving.socket, manager, presence)
    clock.advance(5_000)
    handleDisconnect(leaving.socket, manager, presence)
    clock.advance(5_000)
    presence.sweep()

    const sent = remaining.send.mock.calls.map(([raw]) => JSON.parse(raw))
    expect(sent).toEqual([])
    expect(transition).toHaveBeenCalledTimes(1)
    expect(transition).toHaveBeenCalledWith(ROOM_CODE, 'member', false)
    expect(manager.getClientData(leaving.socket)).toMatchObject({
      roomCode: null,
      isInLobby: false,
    })
  })

  it('does not restore a room subscription when a snapshot query finishes after disconnect', async () => {
    const manager = new WsConnectionManager()
    const leaving = fakeSocket()
    joinRoom(manager, leaving.socket, 'member')
    const clock = new FakeClock(new Date())
    const presence = new Presence(clock, vi.fn())
    let release!: (snapshot: RealtimeSnapshot & { userId: string }) => void
    const query = new Promise<RealtimeSnapshot & { userId: string }>((resolve) => {
      release = resolve
    })
    const snapshots: IGetRealtimeSnapshotUseCase = {
      subscribe: vi.fn(() => query),
      read: vi.fn().mockResolvedValue(null),
    }
    const broadcaster = {
      sendSnapshot: vi.fn(),
      broadcastPresence: vi.fn(),
    } as unknown as WsRoomBroadcaster
    const pending = handleJoinRoom(
      leaving.socket,
      { type: 'join_room', timestamp: 0, payload: { roomCode: ROOM_CODE } },
      manager,
      snapshots,
      presence,
      broadcaster
    )
    handleDisconnect(leaving.socket, manager, presence)
    release({ room: createMockRoom(), players: [], expiresAt: clock.now(), userId: 'member' })
    await pending
    expect(manager.getRoomSockets(ROOM_CODE)).toBeUndefined()
    expect(manager.connectionCount).toBe(0)
    expect(broadcaster.sendSnapshot).not.toHaveBeenCalled()
    expect(broadcaster.broadcastPresence).not.toHaveBeenCalled()
  })
})
