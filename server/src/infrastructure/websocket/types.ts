import type { WsServerMessage } from '@squadzr/schemas/ws'
import type { WebSocket } from '@fastify/websocket'
import type { IGetRealtimeSnapshotUseCase } from '@application/use-cases/room/get-realtime-snapshot.use-case'
import type { WsConnectionManager } from './ws-connection-manager'
import type { WsRoomBroadcaster } from './room-broadcaster.service'
import type { OrderedOperations } from './ordered-operations'
import type { Presence } from './presence'
import type { Heartbeat } from './heartbeat'

// Server-specific: WebSocket client state (not shared with client)
export interface WsClient {
  userId: string | null
  userName: string | null
  userImage: string | null
  roomCode: string | null
  isInLobby: boolean
  send: (message: WsServerMessage) => void
}

/** Read-only view of live connection state, for diagnostics and tests. */
export interface ConnectionInspection {
  /** Sockets subscribed to the room list (the lobby channel). */
  catalogSubscribers: () => number
  /** Sockets joined to one room's live channel. */
  roomSockets: (roomCode: string) => number
  /** Rooms that have at least one joined socket. */
  trackedRooms: () => number
}

export interface Realtime {
  manager: WsConnectionManager
  snapshots: IGetRealtimeSnapshotUseCase
  presence: Presence
  broadcaster: WsRoomBroadcaster
  heartbeat: Heartbeat
  operations: OrderedOperations
  inspect: ConnectionInspection
  disconnect: (socket: WebSocket) => void
  /** Resolves once every queued realtime operation has settled. */
  drain: () => Promise<void>
  sweep: () => Promise<void>
  shutdown: () => Promise<void>
  isStopped: () => boolean
}
