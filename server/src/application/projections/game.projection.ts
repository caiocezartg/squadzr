import type { GameDto, GameSummaryDto } from '@squadzr/schemas'
import type { Game, GameSummary } from '@domain/entities/game.entity'

/**
 * The domain `thumbnailUrl` travels as the contract's `coverThumbUrl`; both
 * Game DTOs are built from this one projection.
 */
export function toGameSummaryDto(game: GameSummary): GameSummaryDto {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    genres: game.genres.map(({ slug, name }) => ({ slug, name })),
    coverUrl: game.coverUrl,
    coverThumbUrl: game.thumbnailUrl,
  }
}

export function toGameDto(game: Game): GameDto {
  return {
    ...toGameSummaryDto(game),
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  }
}
