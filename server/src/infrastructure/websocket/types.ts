import type { WsServerMessage } from '@squadzr/schemas/ws'
import type { WebSocket } from '@fastify/websocket'
import type { IGetRealtimeSnapshotUseCase } from '@application/use-cases/room/get-realtime-snapshot.use-case'
import type { WsConnectionManager } from './ws-connection-manager'
import type { WsRoomBroadcaster } from './room-broadcaster.service'
import type { OrderedOperations } from './ordered-operations'
import type { Presence } from './presence'
import type { Heartbeat } from './heartbeat'

// Re-export all WS schemas and types from shared package
export * from '@squadzr/schemas/ws'

// Server-specific: WebSocket client state (not shared with client)
export interface WsClient {
  userId: string | null
  userName: string | null
  userImage: string | null
  roomCode: string | null
  isInLobby: boolean
  send: (message: WsServerMessage) => void
}

export interface Realtime {
  manager: WsConnectionManager
  snapshots: IGetRealtimeSnapshotUseCase
  presence: Presence
  broadcaster: WsRoomBroadcaster
  heartbeat: Heartbeat
  operations: OrderedOperations
  disconnect: (socket: WebSocket) => void
  sweep: () => Promise<void>
  shutdown: () => Promise<void>
  isStopped: () => boolean
}
