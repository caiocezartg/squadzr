import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { WS_URL } from '@/env'
import { useNotificationEvents } from '@/hooks/use-notification-events'
import { useWebSocket } from '@/hooks/use-websocket'
import type { RealtimeEventSubscribe, RealtimeStatus } from '@/lib/ws-client'
import {
  applyPresence,
  presenceFromSnapshot,
  type PresenceState,
  type SquadSnapshot,
} from './squad-snapshot'
import { useSquadSnapshotCache, type SquadSnapshotCache } from './squad-snapshot-cache'

/** The Presence a cached snapshot carries, which the fresh snapshot replaces; none on a cold cache. */
function presenceOfCached(snapshot: SquadSnapshot | null): PresenceState {
  return snapshot ? presenceFromSnapshot(snapshot) : {}
}

/**
 * The snapshot the cache holds for the Squad, only while the channel is enabled: a viewer outside the Squad is
 * shown its public view, and no join would ever replace a roster they no longer have access to.
 */
function readCached(cache: SquadSnapshotCache, enabled: boolean, squadCode: string) {
  return enabled ? cache.read(squadCode) : null
}

/** Squad codes travel uppercased by contract; URLs may still arrive lowercase. */
function matchesSquadCode(eventCode: string, squadCode: string): boolean {
  return eventCode.toUpperCase() === squadCode.toUpperCase()
}

interface UseSquadChannelOptions {
  squadCode: string
  /** Only an authenticated member joins; visitors never enter the squad channel. */
  enabled: boolean
  /** A Squad this tab was watching was removed from the board. */
  onSquadRemoved: (squadId: string) => void
}

export interface SquadChannel {
  status: RealtimeStatus
  snapshot: SquadSnapshot | null
  /** The snapshot came from the socket, not from the cache the channel started from; false while none shows. */
  snapshotIsLive: boolean
  presence: PresenceState
  /** The code of the latest realtime error. The page translates it; the server's text is not shown. */
  errorCode: string | null
  membershipRevoked: boolean
  /** Registers a handler for a server event on this page's socket, for features that ride the same socket. */
  on: RealtimeEventSubscribe
  dismissError: () => void
  /** Tells the server this tab is leaving the squad channel (Presence only). */
  notifySquadLeave: (squadCode: string) => void
  /** Tells the server this member is typing in the Squad's chat; it forwards it to the other members. */
  notifyTyping: (squadCode: string) => void
}

/**
 * The Lobby's realtime channel. Owns the socket, the join/leave lifecycle of the squad channel, the
 * authoritative snapshot, Presence and the membership error state.
 *
 * The last snapshot of each Squad outlives the page in the query cache. A return to a Squad renders it at
 * once, and the fresh snapshot the join delivers replaces it entirely, Presence included. A Squad the
 * viewer lost access to, or is not a member of, drops its entry and renders none, so a stale roster never shows.
 *
 * Unmounting the Lobby only closes the channel: the server then drops this tab's Presence. Leaving the
 * Squad is a different workflow (see `use-squad-membership`), because it also ends the durable Membership.
 */
export function useSquadChannel({
  squadCode,
  enabled,
  onSquadRemoved,
}: UseSquadChannelOptions): SquadChannel {
  const snapshotCache = useSquadSnapshotCache()
  const [snapshot, setSnapshot] = useState<SquadSnapshot | null>(() =>
    readCached(snapshotCache, enabled, squadCode)
  )
  const [presence, setPresence] = useState<PresenceState>(() =>
    presenceOfCached(readCached(snapshotCache, enabled, squadCode))
  )
  // The snapshot is the one the socket delivered, not the cached one it started from.
  const [snapshotIsLive, setSnapshotIsLive] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  // The channel the live state above belongs to: its Squad, or none while the channel is disabled. It is adjusted
  // while rendering, so a page that moves to another Squad never paints the previous one's roster for a commit,
  // and a viewer found outside the Squad never paints a roster at all: it shows the new Squad's cached snapshot,
  // or placeholders on a cold cache.
  const channelKey = enabled ? squadCode.toUpperCase() : null
  const [stateKey, setStateKey] = useState(channelKey)
  if (stateKey !== channelKey) {
    const cached = readCached(snapshotCache, enabled, squadCode)
    setStateKey(channelKey)
    setSnapshot(cached)
    setPresence(presenceOfCached(cached))
    setSnapshotIsLive(false)
    setErrorCode(null)
  }
  // The Squad whose Membership was revoked, so a stale flag never reaches the next Squad this page renders:
  // the reset below only lands a commit after the code changes.
  const [revokedCode, setRevokedCode] = useState<string | null>(null)
  const membershipRevoked = revokedCode !== null && matchesSquadCode(revokedCode, squadCode)

  const { status, send, on, subscribe } = useWebSocket(WS_URL)

  // This page's socket is also where user-targeted notification pushes arrive.
  useNotificationEvents({ on })

  // The code this page last asked the server to join. When it changes, the socket must release the
  // previous squad channel before joining the new one.
  const joinedCodeRef = useRef<string | null>(null)
  // The Squad code currently rendered. It updates in the commit phase, before the transport can hand
  // another frame to the previous Squad's handlers, so a late error from a Squad this page has already
  // left sees a mismatch below.
  const activeCodeRef = useRef(squadCode)

  // Whether the socket is open now. The join effect reads it without depending on it, so a connection change
  // never resets the channel.
  const statusRef = useRef(status)

  useLayoutEffect(() => {
    activeCodeRef.current = squadCode
    statusRef.current = status
  }, [squadCode, status])

  useEffect(() => {
    // A different Squad code must never show the previous Squad's live state: it starts from the snapshot the
    // cache holds for this Squad, which the join's fresh snapshot replaces.
    const cached = readCached(snapshotCache, enabled, squadCode)
    setSnapshot(cached)
    setPresence(presenceOfCached(cached))
    setSnapshotIsLive(false)
    setErrorCode(null)
    setRevokedCode(null)

    const previousCode = joinedCodeRef.current
    joinedCodeRef.current = enabled ? squadCode : null
    // The socket releases the room it was in when the page moves to another Squad, and when it stops joining
    // at all (the viewer is outside the Squad it moved to): the room's members must not keep seeing this tab.
    // A socket that is not open has joined nothing (its join is only replayed on open, and the subscription
    // ends here), so there is no room to leave and no frame to try.
    if (previousCode && (!enabled || previousCode !== squadCode) && statusRef.current === 'open') {
      send({ type: 'leave_room', payload: { roomCode: previousCode } })
    }
    if (!enabled) {
      // The viewer is outside the Squad: whatever roster the cache holds is no longer theirs to show.
      snapshotCache.discard(squadCode)
      return
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
          snapshotCache.write(squadCode, payload)
          setSnapshot(payload)
          setSnapshotIsLive(true)
          setPresence(presenceFromSnapshot(payload))
          // The authoritative snapshot of this Squad supersedes any error a previous join left behind
          // (e.g. a late NOT_ROOM_MEMBER).
          setErrorCode(null)
          setRevokedCode(null)
        },
        presence_updated: (payload) => {
          if (!matchesSquadCode(payload.roomCode, squadCode)) return
          setPresence((current) =>
            applyPresence(current, payload.playerId, {
              online: payload.online,
              offlineSince: payload.offlineSince,
            })
          )
        },
        room_deleted: (payload) => {
          if (!matchesSquadCode(payload.roomCode, squadCode)) return
          snapshotCache.discard(squadCode)
          onSquadRemoved(payload.roomId)
        },
        error: (payload) => {
          // Error payloads carry no roomCode, so the join order is the only evidence: a handler from a
          // Squad the page has already left must not poison the new Squad with a delayed error.
          if (activeCodeRef.current !== squadCode) return
          setErrorCode(payload.code)
          if (payload.code === 'NOT_ROOM_MEMBER') {
            // Membership was revoked: the last snapshot is no longer authorized, so the page falls back to
            // the error alone, and the cache forgets it.
            snapshotCache.discard(squadCode)
            setSnapshot(null)
            setSnapshotIsLive(false)
            setPresence({})
            setRevokedCode(squadCode)
          }
        },
      }
    )
  }, [subscribe, send, enabled, squadCode, onSquadRemoved, snapshotCache])

  const dismissError = useCallback(() => setErrorCode(null), [])

  const notifySquadLeave = useCallback(
    (code: string) => send({ type: 'leave_room', payload: { roomCode: code } }),
    [send]
  )

  const notifyTyping = useCallback(
    (code: string) => send({ type: 'chat_typing', payload: { roomCode: code } }),
    [send]
  )

  return {
    status,
    snapshot,
    snapshotIsLive,
    presence,
    errorCode,
    membershipRevoked,
    on,
    dismissError,
    notifySquadLeave,
    notifyTyping,
  }
}
