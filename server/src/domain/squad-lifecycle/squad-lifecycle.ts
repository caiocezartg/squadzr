import type {
  MemberRecruitingSquad,
  MemberSquad,
  PublicRecruitingSquad,
  SquadLanguage,
} from '@squadzr/types'

/** The application seam for all persistent Squad lifecycle behavior. */
export interface SquadLifecycle {
  listRecruitingSquads(): Promise<ReadonlyArray<PublicRecruitingSquad>>
  getPublic(code: string): Promise<PublicRecruitingSquad | null>
  getCurrent(actorId: string): Promise<MemberSquad | null>
  create(command: CreateSquadCommand): Promise<MemberRecruitingSquad>
  join(command: JoinSquadCommand): Promise<MemberSquad>
  leaveCurrent(command: LeaveCurrentSquadCommand): Promise<LeaveCurrentSquadResult>
  endExpired(): Promise<EndExpiredSquadsResult>
}

export interface CreateSquadCommand {
  actorId: string
  idempotencyKey: string
  name: string
  gameId: string
  maxMembers: number
  discordInvitation: string
  tags: readonly string[]
  language: SquadLanguage
}

export interface JoinSquadCommand {
  actorId: string
  idempotencyKey: string
  squadCode: string
}

export interface LeaveCurrentSquadCommand {
  actorId: string
  idempotencyKey: string
}

export interface LeaveCurrentSquadResult {
  endedSquad: boolean
}

export interface EndExpiredSquadsResult {
  endedSquadIds: readonly string[]
}

/** Internal dependencies. Callers never coordinate time or identifiers themselves. */
export interface Clock {
  now(): Date
}

export interface Identifier {
  newId(): string
  squadCode(): string
}
