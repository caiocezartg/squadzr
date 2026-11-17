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
import { reloadAfterSessionEnded, reloadToMatchingBuild } from '@/lib/realtime-update'

interface UseWebSocketReturn {
  status: RealtimeStatus
  send: (message: WsIncomingMessageInput) => void
  on: <T extends WsServerEventType>(
    type: T,
    handler: (payload: WsServerEventPayload<T>) => void
  ) => () => void
  subscribe: (subscription: RealtimeSubscription, handlers: RealtimeChannelHandlers) => () => void
}

/** A handler registered through `on`, attached to whichever client the screen holds. */
interface EventRegistration {
  readonly type: WsServerEventType
  readonly handler: (payload: never) => void
  detach: (() => void) | null
}

function attachRegistration(client: WebSocketClient, listener: EventRegistration): void {
  listener.detach = client.on(
    listener.type,
    listener.handler as (payload: WsServerEventPayload<WsServerEventType>) => void
  )
}

function detachRegistration(listener: EventRegistration): void {
  listener.detach?.()
  listener.detach = null
}

const noop = () => {
  // noop
}

/**
 * Opens the realtime connection of a screen. The socket lives for the mount and reconnects on its
 * own; the screen only sends frames and registers handlers. A protocol mismatch reloads the app
 * into the matching build, and a session the server ended reloads it signed out.
 */
export function useWebSocket(url: string): UseWebSocketReturn {
  const [status, setStatus] = useState<RealtimeStatus>('closed')
  const clientRef = useRef<WebSocketClient | null>(null)
  // Handlers outlive the client: a child's effect runs before this hook creates the client, and a new
  // `url` replaces the client, so `on` keeps them here and attaches them to each client in turn.
  const listenersRef = useRef(new Set<EventRegistration>())

  useEffect(() => {
    const client = new WebSocketClient({
      url,
      onProtocolFailure: reloadToMatchingBuild,
      onSessionEnded: reloadAfterSessionEnded,
    })

    // One set for the hook's life, so the cleanup below sees the registrations made since.
    const registrations = listenersRef.current
    clientRef.current = client
    for (const registration of registrations) attachRegistration(client, registration)
    const unsubscribeStatus = client.onStatusChange(setStatus)
    client.connect()

    return () => {
      unsubscribeStatus()
      for (const registration of registrations) detachRegistration(registration)
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
      const listener: EventRegistration = {
        type,
        handler: handler as EventRegistration['handler'],
        detach: null,
      }
      listenersRef.current.add(listener)
      if (clientRef.current) attachRegistration(clientRef.current, listener)
      return () => {
        detachRegistration(listener)
        listenersRef.current.delete(listener)
      }
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
