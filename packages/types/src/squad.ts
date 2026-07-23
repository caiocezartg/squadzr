export type SquadLifecycleState = 'recruiting' | 'ready'

export type MembershipRole = 'owner' | 'member'

export type SquadLanguage = 'en' | 'pt-br'

/**
 * The only projection safe to expose to unauthenticated callers. It deliberately
 * contains no member identity, owner identity, Presence, or Discord invitation.
 */
export type PublicRecruitingSquad = {
  id: string
  code: string
  name: string
  gameId: string
  maxMembers: number
  memberCount: number
  tags: string[]
  language: SquadLanguage
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export type SquadRosterMembership = {
  userId: string
  name: string
  image: string | null
  role: MembershipRole
  online: boolean
}

type MemberSquadBase = {
  id: string
  code: string
  name: string
  gameId: string
  maxMembers: number
  tags: string[]
  language: SquadLanguage
  roster: SquadRosterMembership[]
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export type MemberRecruitingSquad = MemberSquadBase & {
  state: 'recruiting'
}

export type MemberReadySquad = MemberSquadBase & {
  state: 'ready'
  readyAt: Date
  discordInvitation: string
}

export type MemberSquad = MemberRecruitingSquad | MemberReadySquad

export type ReadyNotification = {
  id: string
  squadId: string
  squadCode: string
  squadName: string
  gameName: string
  discordInvitation: string
  readAt: Date | null
  createdAt: Date
}
