import type { GameDto } from '@squadzr/schemas'
import type { Game } from '@domain/entities/game.entity'

export function toGameDto(game: Game): GameDto {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    genres: game.genres.map((genre) => ({ slug: genre.slug, name: genre.name })),
    coverUrl: game.coverUrl,
    // The contract names the catalog's small crop `coverThumbUrl`; the domain
    // keeps the `thumbnailUrl` it stores.
    coverThumbUrl: game.thumbnailUrl,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  }
}
