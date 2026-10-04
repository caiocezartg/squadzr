import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { WS_URL } from '@/env'
import { useNotificationEvents } from '@/hooks/use-notification-events'
import { useWebSocket } from '@/hooks/use-websocket'
import type { RealtimeStatus } from '@/lib/ws-client'
import {
  applyPresence,
  presenceFromSnapshot,
  type PresenceState,
  type RoomSnapshot,
} from './room-snapshot'

/** Room codes travel uppercased by contract; URLs may still arrive lowercase. */
function matchesRoomCode(eventCode: string, code: string): boolean {
  return eventCode.toUpperCase() === code.toUpperCase()
}

interface UseRoomChannelOptions {
  roomCode: string
  /** Only an authenticated member joins; visitors never enter the room channel. */
  enabled: boolean
  /** A room this tab was watching was removed from the catalog. */
  onRoomRemoved: (roomId: string) => void
}

export interface RoomChannel {
  status: RealtimeStatus
  snapshot: RoomSnapshot | null
  presence: PresenceState
  error: string | null
  membershipRevoked: boolean
  dismissError: () => void
  /** Tells the server this tab is leaving the room channel (Presence only). */
  notifyRoomLeave: (roomCode: string) => void
}

/**
 * The lobby's realtime channel. Owns the socket, the join/leave lifecycle of
 * the room channel, the authoritative snapshot, Presence and the membership
 * error state.
 *
 * Unmounting the route only closes the channel: the server then drops this
 * tab's Presence. Leaving the room is a different workflow (see
 * `use-room-membership`), because it also ends the durable Membership.
 */
export function useRoomChannel({
  roomCode,
  enabled,
  onRoomRemoved,
}: UseRoomChannelOptions): RoomChannel {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [presence, setPresence] = useState<PresenceState>({})
  const [error, setError] = useState<string | null>(null)
  const [membershipRevoked, setMembershipRevoked] = useState(false)

  const { status, send, on, subscribe } = useWebSocket({ url: WS_URL, autoConnect: true })

  // This page's socket is also where user-targeted notification pushes arrive.
  useNotificationEvents({ on })

  // The code this page last asked the server to join. When it changes, the
  // socket must release the previous room channel before joining the new one.
  const joinedCodeRef = useRef<string | null>(null)
  // The `:code` currently rendered. It updates in the commit phase, before the
  // transport can hand another frame to the previous room's handlers, so a
  // late error from a room this page has already left sees a mismatch below.
  const activeCodeRef = useRef(roomCode)

  useLayoutEffect(() => {
    activeCodeRef.current = roomCode
  }, [roomCode])

  useEffect(() => {
    // A different room code must never show the previous room's live state.
    setSnapshot(null)
    setPresence({})
    setError(null)
    setMembershipRevoked(false)

    const previousCode = joinedCodeRef.current
    joinedCodeRef.current = enabled ? roomCode : null
    if (!enabled) return

    if (previousCode && previousCode !== roomCode) {
      send({ type: 'leave_room', payload: { roomCode: previousCode } })
    }

    // The transport replays this subscription after every reconnect and the
    // fresh snapshot replaces all live state.
    return subscribe(
      { type: 'join_room', payload: { roomCode } },
      {
        room_snapshot: (payload) => {
          // Events for the previous room may still be in flight while the
          // server processes the switch; they must never touch this page.
          if (!matchesRoomCode(payload.room.code, roomCode)) return
          setSnapshot(payload)
          setPresence(presenceFromSnapshot(payload))
          // The authoritative snapshot of this room supersedes any error a
          // previous join left behind (e.g. a late NOT_ROOM_MEMBER).
          setError(null)
          setMembershipRevoked(false)
        },
        presence_updated: (payload) => {
          if (!matchesRoomCode(payload.roomCode, roomCode)) return
          setPresence((current) => applyPresence(current, payload.playerId, payload.online))
        },
        room_deleted: (payload) => {
          if (!matchesRoomCode(payload.roomCode, roomCode)) return
          onRoomRemoved(payload.roomId)
        },
        error: (payload) => {
          // Error payloads carry no roomCode, so the join order is the only
          // evidence: a handler from a room the page has already left must not
          // poison the new room with a delayed error.
          if (activeCodeRef.current !== roomCode) return
          setError(payload.message)
          if (payload.code === 'NOT_ROOM_MEMBER') {
            // Membership was revoked: the last snapshot is no longer
            // authorized, so the page falls back to the error alone.
            setSnapshot(null)
            setPresence({})
            setMembershipRevoked(true)
          }
        },
      }
    )
  }, [subscribe, send, enabled, roomCode, onRoomRemoved])

  const dismissError = useCallback(() => setError(null), [])

  const notifyRoomLeave = useCallback(
    (code: string) => send({ type: 'leave_room', payload: { roomCode: code } }),
    [send]
  )

  return {
    status,
    snapshot,
    presence,
    error,
    membershipRevoked,
    dismissError,
    notifyRoomLeave,
  }
}
