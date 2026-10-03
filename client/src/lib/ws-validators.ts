import { describeContractIssues } from '@squadzr/schemas'
import {
  wsServerEventPayloadSchemas,
  type WsServerEventPayload,
  type WsServerEventType,
} from '@squadzr/schemas/ws'
import type { WebSocketEventHandler } from './ws-client'

type Subscribe = (event: string, handler: WebSocketEventHandler) => () => void

/**
 * Parses the payload of a server event against its contract in @squadzr/schemas.
 * A mismatch is reported by issue path and code only, never by payload content.
 */
export function parseServerEvent<T extends WsServerEventType>(
  type: T,
  raw: unknown
): WsServerEventPayload<T> | null {
  const result = wsServerEventPayloadSchemas[type].safeParse(raw)
  if (!result.success) {
    console.error('Invalid WebSocket payload:', {
      type,
      issues: describeContractIssues(result.error),
    })
    return null
  }
  return result.data as WsServerEventPayload<T>
}

/**
 * Subscribes to a server event through the transport's `on`, handing the
 * handler a validated, typed payload. Invalid payloads are dropped before they
 * reach the handler.
 */
export function onServerEvent<T extends WsServerEventType>(
  on: Subscribe,
  type: T,
  handler: (payload: WsServerEventPayload<T>) => void
): () => void {
  return on(type, (raw) => {
    const payload = parseServerEvent(type, raw)
    if (payload) handler(payload)
  })
}
