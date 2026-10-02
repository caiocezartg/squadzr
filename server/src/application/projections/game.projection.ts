import type { GameDto } from '@squadzr/schemas'
import type { Game } from '@domain/entities/game.entity'

export function toGameDto(game: Game): GameDto {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    coverUrl: game.coverUrl,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  }
}
