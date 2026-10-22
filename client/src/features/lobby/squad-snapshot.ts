import type { WsServerEventPayload } from '@squadzr/schemas/ws'
import type { Player } from '@/types'

/** The authoritative squad snapshot the server pushes on the squad channel. */
export type SquadSnapshot = WsServerEventPayload<'room_snapshot'>

/** Presence keyed by member id: online while a healthy session participates. */
export type PresenceState = Record<string, boolean>

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
  return Object.fromEntries(snapshot.presence.map((entry) => [entry.playerId, entry.online]))
}

/**
 * Presence assigns a boolean to an existing member; it never adds or removes a
 * Membership. Re-applying the same value returns the previous state.
 */
export function applyPresence(
  state: PresenceState,
  playerId: string,
  online: boolean
): PresenceState {
  if (state[playerId] === online) return state
  return { ...state, [playerId]: online }
}
