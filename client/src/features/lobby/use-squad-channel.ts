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
function matchesSquadCode(eventCode: string, squadCode: string): boolean {
  return eventCode.toUpperCase() === squadCode.toUpperCase()
}

interface UseSquadChannelOptions {
  squadCode: string
  /** Only an authenticated member joins; visitors never enter the room channel. */
  enabled: boolean
  /** A Squad this tab was watching was removed from the board. */
  onSquadRemoved: (squadId: string) => void
}

export interface SquadChannel {
  status: RealtimeStatus
  snapshot: RoomSnapshot | null
  presence: PresenceState
  /** The code of the latest realtime error. The page translates it; the server's text is not shown. */
  errorCode: string | null
  membershipRevoked: boolean
  dismissError: () => void
  /** Tells the server this tab is leaving the room channel (Presence only). */
  notifySquadLeave: (squadCode: string) => void
}

/**
 * The Lobby's realtime channel. Owns the socket, the join/leave lifecycle of the room channel, the
 * authoritative snapshot, Presence and the membership error state.
 *
 * Unmounting the Lobby only closes the channel: the server then drops this tab's Presence. Leaving the
 * Squad is a different workflow (see `use-squad-membership`), because it also ends the durable Membership.
 */
export function useSquadChannel({
  squadCode,
  enabled,
  onSquadRemoved,
}: UseSquadChannelOptions): SquadChannel {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [presence, setPresence] = useState<PresenceState>({})
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [membershipRevoked, setMembershipRevoked] = useState(false)

  const { status, send, on, subscribe } = useWebSocket({ url: WS_URL, autoConnect: true })

  // This page's socket is also where user-targeted notification pushes arrive.
  useNotificationEvents({ on })

  // The code this page last asked the server to join. When it changes, the socket must release the
  // previous room channel before joining the new one.
  const joinedCodeRef = useRef<string | null>(null)
  // The Squad code currently rendered. It updates in the commit phase, before the transport can hand
  // another frame to the previous Squad's handlers, so a late error from a Squad this page has already
  // left sees a mismatch below.
  const activeCodeRef = useRef(squadCode)

  useLayoutEffect(() => {
    activeCodeRef.current = squadCode
  }, [squadCode])

  useEffect(() => {
    // A different Squad code must never show the previous Squad's live state.
    setSnapshot(null)
    setPresence({})
    setErrorCode(null)
    setMembershipRevoked(false)

    const previousCode = joinedCodeRef.current
    joinedCodeRef.current = enabled ? squadCode : null
    if (!enabled) return

    if (previousCode && previousCode !== squadCode) {
      send({ type: 'leave_room', payload: { roomCode: previousCode } })
    }

    // The transport replays this subscription after every reconnect and the fresh snapshot replaces all
    // live state.
    return subscribe(
      { type: 'join_room', payload: { roomCode: squadCode } },
      {
        room_snapshot: (payload) => {
          // Events for the previous Squad may still be in flight while the server processes the switch;
          // they must never touch this page.
          if (!matchesSquadCode(payload.room.code, squadCode)) return
          setSnapshot(payload)
          setPresence(presenceFromSnapshot(payload))
          // The authoritative snapshot of this Squad supersedes any error a previous join left behind
          // (e.g. a late NOT_ROOM_MEMBER).
          setErrorCode(null)
          setMembershipRevoked(false)
        },
        presence_updated: (payload) => {
          if (!matchesSquadCode(payload.roomCode, squadCode)) return
          setPresence((current) => applyPresence(current, payload.playerId, payload.online))
        },
        room_deleted: (payload) => {
          if (!matchesSquadCode(payload.roomCode, squadCode)) return
          onSquadRemoved(payload.roomId)
        },
        error: (payload) => {
          // Error payloads carry no roomCode, so the join order is the only evidence: a handler from a
          // Squad the page has already left must not poison the new Squad with a delayed error.
          if (activeCodeRef.current !== squadCode) return
          setErrorCode(payload.code)
          if (payload.code === 'NOT_ROOM_MEMBER') {
            // Membership was revoked: the last snapshot is no longer authorized, so the page falls back to
            // the error alone.
            setSnapshot(null)
            setPresence({})
            setMembershipRevoked(true)
          }
        },
      }
    )
  }, [subscribe, send, enabled, squadCode, onSquadRemoved])

  const dismissError = useCallback(() => setErrorCode(null), [])

  const notifySquadLeave = useCallback(
    (code: string) => send({ type: 'leave_room', payload: { roomCode: code } }),
    [send]
  )

  return {
    status,
    snapshot,
    presence,
    errorCode,
    membershipRevoked,
    dismissError,
    notifySquadLeave,
  }
}
