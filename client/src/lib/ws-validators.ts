import { describeContractIssues } from '@squadzr/schemas'
import {
  wsServerEventPayloadSchemas,
  type WsServerEventPayload,
  type WsServerEventType,
} from '@squadzr/schemas/ws'

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
