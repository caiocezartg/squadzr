import { chooseNextHost, type HostCandidate } from './choose-next-host'

/** An Open Squad that holds Memberships of the Squad that just became Ready. */
export interface AffectedSquad {
  readonly roomId: string
  readonly hostId: string
  /** Every Membership of the Squad, read under its lock. */
  readonly members: readonly HostCandidate[]
}

/**
 * What the Squad Release did to one Squad. `newHostId` is set only when the host changed
 * (outcome `updated`); it is null when the host stayed and for `closed` and `deleted`.
 */
export interface SquadDeparture {
  readonly roomId: string
  readonly roomCode: string
  readonly roomName: string
  readonly gameName: string
  /** Absent when the Squad's Game has no cover. */
  readonly gameCoverUrl?: string
  readonly outcome: 'updated' | 'closed' | 'deleted'
  readonly removedUserIds: readonly string[]
  readonly remainingUserIds: readonly string[]
  readonly previousHostId: string
  readonly newHostId: string | null
}

/** The decision for one Squad, before the repository adds what it reads from the rows. */
export type PlannedDeparture = Pick<
  SquadDeparture,
  'roomId' | 'outcome' | 'removedUserIds' | 'remainingUserIds' | 'previousHostId' | 'newHostId'
>

export interface SquadReleasePlanInput {
  /** Members of the Squad that became Ready: they leave every other Open Squad. */
  readonly releasedUserIds: ReadonlySet<string>
  /** The affected Squads, in ascending `roomId` order. */
  readonly squads: readonly AffectedSquad[]
  /** People who already host a valid Open Squad, as read under lock. */
  readonly hostingUserIds: ReadonlySet<string>
}

/**
 * Remaining members of the Squads that lose their host: the only people who can inherit one,
 * so the only ones whose hosting has to be read under lock. Ascending, without repeats.
 */
export function hostCandidateIds(
  squads: readonly AffectedSquad[],
  releasedUserIds: ReadonlySet<string>
): string[] {
  const candidates = new Set<string>()
  for (const squad of squads) {
    if (!releasedUserIds.has(squad.hostId)) continue
    for (const member of squad.members) {
      if (!releasedUserIds.has(member.userId)) candidates.add(member.userId)
    }
  }
  return [...candidates].sort()
}

/**
 * Squad Release: who leaves which Squad, who inherits a hostless Squad, and which Squad ends.
 * Squads are decided in the order given (ascending `roomId`), and whoever inherits one is no
 * longer eligible for the next, so nobody ends up hosting two Open Squads. Removing a member
 * never fills a Squad, so the decisions do not cascade.
 */
export function planSquadRelease(input: SquadReleasePlanInput): PlannedDeparture[] {
  const { releasedUserIds, squads } = input
  const ineligible = new Set(input.hostingUserIds)

  return squads.map((squad): PlannedDeparture => {
    const removedUserIds = squad.members
      .filter((member) => releasedUserIds.has(member.userId))
      .map((member) => member.userId)
    const remaining = squad.members.filter((member) => !releasedUserIds.has(member.userId))
    const remainingUserIds = remaining.map((member) => member.userId)
    const base = {
      roomId: squad.roomId,
      removedUserIds,
      remainingUserIds,
      previousHostId: squad.hostId,
    }

    if (remaining.length === 0) return { ...base, outcome: 'deleted', newHostId: null }
    if (!releasedUserIds.has(squad.hostId)) return { ...base, outcome: 'updated', newHostId: null }

    const newHostId = chooseNextHost(remaining, ineligible)
    if (newHostId === null) return { ...base, outcome: 'closed', newHostId: null }

    ineligible.add(newHostId)
    return { ...base, outcome: 'updated', newHostId }
  })
}
