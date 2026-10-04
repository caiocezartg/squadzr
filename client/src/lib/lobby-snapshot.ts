import type { WsServerEventPayload } from '@squadzr/schemas/ws'
import type { Player } from '@/types'

export type RoomSnapshot = WsServerEventPayload<'room_snapshot'>
export type PresenceState = Record<string, boolean>

/**
 * The authoritative roster of a room snapshot. A repeated player id is
 * collapsed so duplicate entries can never render twice.
 */
export function rosterFromSnapshot(snapshot: RoomSnapshot): Player[] {
  const seen = new Set<string>()
  return snapshot.players.filter((player) => {
    if (seen.has(player.id)) return false
    seen.add(player.id)
    return true
  })
}

export function presenceFromSnapshot(snapshot: RoomSnapshot): PresenceState {
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
