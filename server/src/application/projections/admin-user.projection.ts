import type {
  AdminUserCompletedSquadDto,
  AdminUserDetailDto,
  AdminUserDto,
  AdminUserListItemDto,
  AdminUserSquadDto,
} from '@squadzr/schemas'
import type {
  AdminUser,
  AdminUserCompletedSquad,
  AdminUserListItem,
  AdminUserOpenSquad,
} from '@domain/entities/admin-user.entity'
import type { GetAdminUserOutput } from '@application/use-cases/admin/get-admin-user.use-case'
import { toProfileGameDto } from './player-profile.projection'

/**
 * What the admin panel shows of a person, built field by field from the entity so the email, which
 * the user row holds, can never reach an admin response.
 */
export function toAdminUserDto(user: AdminUser): AdminUserDto {
  return {
    id: user.id,
    name: user.name,
    image: user.avatarUrl,
    discordId: user.discordId,
    joinedAt: user.createdAt.toISOString(),
    role: user.role,
  }
}

export function toAdminUserListItemDto(user: AdminUserListItem): AdminUserListItemDto {
  return { ...toAdminUserDto(user), openSquads: user.openSquads }
}

function toAdminUserSquadDto(squad: AdminUserOpenSquad): AdminUserSquadDto {
  return {
    id: squad.id,
    code: squad.code,
    name: squad.name,
    game: toProfileGameDto(squad.game),
    memberCount: squad.memberCount,
    maxPlayers: squad.maxPlayers,
    isHost: squad.isHost,
  }
}

function toAdminUserCompletedSquadDto(squad: AdminUserCompletedSquad): AdminUserCompletedSquadDto {
  return {
    id: squad.id,
    name: squad.name,
    game: toProfileGameDto(squad.game),
    maxPlayers: squad.maxPlayers,
    readyAt: squad.readyAt.toISOString(),
  }
}

export function toAdminUserDetailDto(detail: GetAdminUserOutput): AdminUserDetailDto {
  return {
    ...toAdminUserDto(detail.user),
    online: detail.online,
    squadLimits: detail.squadLimits,
    openSquads: detail.openSquads.map(toAdminUserSquadDto),
    completedSquads: detail.completedSquads,
    gamesPlayed: detail.gamesPlayed,
    latestCompleted: detail.latestCompleted.map(toAdminUserCompletedSquadDto),
  }
}
