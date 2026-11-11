/** A member who may inherit a Squad: who they are and since when they have been in it. */
export interface HostCandidate {
  readonly userId: string
  readonly joinedAt: Date
}

/**
 * Host Transfer: the member who has been in the Squad the longest and is not in
 * `ineligibleUserIds` (people who already host another Open Squad). A tie on
 * `joinedAt` goes to the smaller `userId`. Returns that member's id, or null when
 * nobody is eligible.
 */
export function chooseNextHost(
  members: readonly HostCandidate[],
  ineligibleUserIds: ReadonlySet<string>
): string | null {
  let chosen: HostCandidate | null = null
  for (const member of members) {
    if (ineligibleUserIds.has(member.userId)) continue
    if (chosen === null || isEarlier(member, chosen)) chosen = member
  }
  return chosen?.userId ?? null
}

function isEarlier(candidate: HostCandidate, current: HostCandidate): boolean {
  const byJoin = candidate.joinedAt.getTime() - current.joinedAt.getTime()
  return byJoin !== 0 ? byJoin < 0 : candidate.userId < current.userId
}
