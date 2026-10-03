import type { WsServerMessage } from '@squadzr/schemas/ws'

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
