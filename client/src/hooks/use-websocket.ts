import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  WsIncomingMessageInput,
  WsServerEventPayload,
  WsServerEventType,
} from '@squadzr/schemas/ws'
import {
  WebSocketClient,
  type ProtocolFailureReason,
  type RealtimeChannelHandlers,
  type RealtimeStatus,
  type RealtimeSubscription,
} from '@/lib/ws-client'
import { reloadToMatchingBuild } from '@/lib/realtime-update'

export interface ReconnectOptions {
  /** First reconnection delay; each failed attempt doubles it. */
  baseDelayMs?: number
  /** Upper bound of the exponential delay before jitter. */
  maxDelayMs?: number
  maxAttempts?: number
  /** Returns a value in [0, 1); injected for deterministic backoff in tests. */
  random?: () => number
}

interface UseWebSocketOptions {
  url: string
  autoConnect?: boolean
  reconnect?: ReconnectOptions
  onProtocolFailure?: (reason: ProtocolFailureReason) => void
}

interface UseWebSocketReturn {
  status: RealtimeStatus
  isConnected: boolean
  connect: () => void
  disconnect: () => void
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

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, autoConnect = true, reconnect, onProtocolFailure } = options
  const baseDelayMs = reconnect?.baseDelayMs
  const maxDelayMs = reconnect?.maxDelayMs
  const maxAttempts = reconnect?.maxAttempts
  const random = reconnect?.random

  const [status, setStatus] = useState<RealtimeStatus>('closed')
  const clientRef = useRef<WebSocketClient | null>(null)

  useEffect(() => {
    const client = new WebSocketClient({
      url,
      reconnectInterval: baseDelayMs,
      reconnectMaxDelay: maxDelayMs,
      maxReconnectAttempts: maxAttempts,
      random,
      onProtocolFailure: onProtocolFailure ?? reloadToMatchingBuild,
    })

    clientRef.current = client
    const unsubscribeStatus = client.onStatusChange(setStatus)

    if (autoConnect) {
      client.connect()
    }

    return () => {
      unsubscribeStatus()
      client.disconnect()
      clientRef.current = null
    }
  }, [url, autoConnect, baseDelayMs, maxDelayMs, maxAttempts, random, onProtocolFailure])

  const connect = useCallback(() => {
    clientRef.current?.connect()
  }, [])

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect()
  }, [])

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

  return {
    status,
    isConnected: status === 'open',
    connect,
    disconnect,
    send,
    on,
    subscribe,
  }
}
