import { useState } from 'react'

/** Players who joined a Squad while its card was on screen. */
export interface MemberArrival {
  /** The member count before they joined. */
  readonly from: number
  /** Tells one arrival from the next, so a later one replays its animation. */
  readonly id: number
}

interface Seen {
  readonly memberCount: number
  readonly isMember: boolean
  readonly arrival: MemberArrival | null
  readonly nextId: number
}

/**
 * The arrival a card plays: set when `memberCount` rises while the card is mounted. It is derived
 * while rendering from the last count the card saw, never in an effect, so a mount (a first visit, a
 * warm-cache return, hydration, a StrictMode double effect) never plays one. The viewer's own join
 * turns the card into a member card and plays nothing; a count that falls (a leave) clears it.
 */
export function useMemberArrival(
  memberCount: number,
  isMember: boolean,
  enabled: boolean
): MemberArrival | null {
  const [seen, setSeen] = useState<Seen>({ memberCount, isMember, arrival: null, nextId: 1 })

  if (seen.memberCount === memberCount && seen.isMember === isMember) return seen.arrival

  const rose = enabled && memberCount > seen.memberCount && isMember === seen.isMember
  const next: Seen = {
    memberCount,
    isMember,
    arrival: rose ? { from: seen.memberCount, id: seen.nextId } : null,
    nextId: seen.nextId + 1,
  }
  setSeen(next)
  return next.arrival
}
