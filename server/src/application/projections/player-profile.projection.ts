import type { PlayerProfileDto, ProfileGameDto } from '@squadzr/schemas'
import type { PlayerStats, ProfileGame } from '@domain/entities/squad-record.entity'
import type { User } from '@domain/entities/user.entity'

function toProfileGameDto(game: ProfileGame): ProfileGameDto {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    coverUrl: game.coverUrl,
    coverThumbUrl: game.thumbnailUrl,
  }
}

/**
 * The public face of a person. It is built field by field from the user, so nothing else the
 * user row holds (the email above all) can reach a response.
 */
export function toPlayerProfileDto(user: User, stats: PlayerStats): PlayerProfileDto {
  return {
    id: user.id,
    name: user.name,
    image: user.avatarUrl,
    memberSince: user.createdAt.toISOString(),
    completedSquads: stats.completedSquads,
    gamesPlayed: stats.gamesPlayed,
    lastSquad: stats.lastSquad
      ? {
          game: toProfileGameDto(stats.lastSquad.game),
          readyAt: stats.lastSquad.readyAt.toISOString(),
        }
      : null,
    topGames: stats.topGames.map(({ game, squads }) => ({
      game: toProfileGameDto(game),
      squads,
    })),
  }
}
