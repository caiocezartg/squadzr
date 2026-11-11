import type { WsServerEventPayload } from '@squadzr/schemas/ws'
import type { Player } from '@/types'

/** The authoritative squad snapshot the server pushes on the squad channel. */
export type SquadSnapshot = WsServerEventPayload<'room_snapshot'>

/** One member's Presence: online while a healthy session participates, else away since `offlineSince`. */
export interface MemberPresence {
  online: boolean
  /** ISO time the member's last session closed; null when the server has no known time. */
  offlineSince: string | null
}

/** Presence keyed by member id. */
export type PresenceState = Record<string, MemberPresence>

/**
 * The roster of a squad snapshot. A repeated player id is collapsed so
 * duplicate entries can never render twice.
 */
export function rosterFromSnapshot(snapshot: SquadSnapshot): Player[] {
  const seen = new Set<string>()
  return snapshot.players.filter((player) => {
    if (seen.has(player.id)) return false
    seen.add(player.id)
    return true
  })
}

/** Projects the snapshot's Presence entries into the state the roster renders. */
export function presenceFromSnapshot(snapshot: SquadSnapshot): PresenceState {
  return Object.fromEntries(
    snapshot.presence.map(({ playerId, online, offlineSince }) => [
      playerId,
      { online, offlineSince },
    ])
  )
}

/**
 * Presence assigns the server's state to an existing member; it never adds or removes a
 * Membership. Re-applying the same value returns the previous state.
 */
export function applyPresence(
  state: PresenceState,
  playerId: string,
  presence: MemberPresence
): PresenceState {
  const current = state[playerId]
  if (current?.online === presence.online && current.offlineSince === presence.offlineSince)
    return state
  return { ...state, [playerId]: presence }
}
