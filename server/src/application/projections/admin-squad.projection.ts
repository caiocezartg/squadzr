import type { AdminSquadDetailDto, AdminSquadDto } from '@squadzr/schemas'
import type { AdminSquad, AdminSquadDetail } from '@domain/entities/admin-squad.entity'

export function toAdminSquadDto(squad: AdminSquad): AdminSquadDto {
  return {
    id: squad.id,
    code: squad.code,
    name: squad.name,
    game: {
      id: squad.game.id,
      name: squad.game.name,
      coverThumbUrl: squad.game.coverThumbUrl,
    },
    platform: squad.platform,
    host: { id: squad.host.id, name: squad.host.name },
    memberCount: squad.memberCount,
    maxPlayers: squad.maxPlayers,
    createdAt: squad.createdAt.toISOString(),
    lastActivityAt: squad.lastActivityAt.toISOString(),
  }
}

/** The side panel's Squad: the list row, the roster and the full invite. Never an email. */
export function toAdminSquadDetailDto(squad: AdminSquadDetail): AdminSquadDetailDto {
  return {
    ...toAdminSquadDto(squad),
    language: squad.language,
    discordLink: squad.discordLink,
    members: squad.members.map((member) => ({
      id: member.id,
      name: member.name,
      image: member.image,
      isHost: member.isHost,
      joinedAt: member.joinedAt.toISOString(),
    })),
  }
}
