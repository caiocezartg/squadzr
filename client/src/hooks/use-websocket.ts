import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  WsIncomingMessageInput,
  WsServerEventPayload,
  WsServerEventType,
} from '@squadzr/schemas/ws'
import {
  WebSocketClient,
  type RealtimeChannelHandlers,
  type RealtimeStatus,
  type RealtimeSubscription,
} from '@/lib/ws-client'
import { reloadToMatchingBuild } from '@/lib/realtime-update'

interface UseWebSocketReturn {
  status: RealtimeStatus
  send: (message: WsIncomingMessageInput) => void
  on: <T extends WsServerEventType>(
    type: T,
    handler: (payload: WsServerEventPayload<T>) => void
  ) => () => void
  subscribe: (subscription: RealtimeSubscription, handlers: RealtimeChannelHandlers) => () => void
}

const noop = () => {
  // noop
}

/**
 * Opens the realtime connection of a screen. The socket lives for the mount and reconnects on its
 * own; the screen only sends frames and registers handlers. A protocol mismatch reloads the app
 * into the matching build.
 */
export function useWebSocket(url: string): UseWebSocketReturn {
  const [status, setStatus] = useState<RealtimeStatus>('closed')
  const clientRef = useRef<WebSocketClient | null>(null)

  useEffect(() => {
    const client = new WebSocketClient({ url, onProtocolFailure: reloadToMatchingBuild })

    clientRef.current = client
    const unsubscribeStatus = client.onStatusChange(setStatus)
    client.connect()

    return () => {
      unsubscribeStatus()
      client.disconnect()
      clientRef.current = null
    }
  }, [url])

  const send = useCallback((message: WsIncomingMessageInput) => {
    clientRef.current?.send(message)
  }, [])

  const on = useCallback(
    <T extends WsServerEventType>(
      type: T,
      handler: (payload: WsServerEventPayload<T>) => void
    ): (() => void) => {
      return clientRef.current?.on(type, handler) ?? noop
    },
    []
  )

  const subscribe = useCallback(
    (subscription: RealtimeSubscription, handlers: RealtimeChannelHandlers): (() => void) => {
      return clientRef.current?.subscribe(subscription, handlers) ?? noop
    },
    []
  )

  return { status, send, on, subscribe }
}
