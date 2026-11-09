import type { AdminGameDetailDto, AdminGameDto, AdminGamesSummaryDto } from '@squadzr/schemas'
import type { AdminGame } from '@domain/entities/admin-game.entity'
import type { GetAdminGamesSummaryOutput } from '@application/use-cases/admin/get-admin-games-summary.use-case'

export function toAdminGameDto({ game, usage }: AdminGame): AdminGameDto {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    coverThumbUrl: game.thumbnailUrl,
    platforms: [...game.platforms],
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    popularity: game.popularity,
    featuredRank: game.featuredRank,
    listed: game.listed,
    usage: { openSquads: usage.openSquads, completedSquads: usage.completedSquads },
  }
}

/** The detail page's Game: the list row plus every other field the catalog holds. */
export function toAdminGameDetailDto(adminGame: AdminGame): AdminGameDetailDto {
  const { game } = adminGame

  return {
    ...toAdminGameDto(adminGame),
    igdbId: game.igdbId,
    genres: game.genres.map(({ slug, name }) => ({ slug, name })),
    aliases: [...game.aliases],
    coverUrl: game.coverUrl,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  }
}

export function toAdminGamesSummaryDto(summary: GetAdminGamesSummaryOutput): AdminGamesSummaryDto {
  const { lastImport } = summary

  return {
    listed: summary.listed,
    delisted: summary.delisted,
    featured: summary.featured,
    lastImport: lastImport && {
      runId: lastImport.runId,
      finishedAt: lastImport.finishedAt.toISOString(),
      entered: {
        total: lastImport.entered.total,
        games: lastImport.entered.games.map((g) => ({ ...g })),
      },
      left: { total: lastImport.left.total, games: lastImport.left.games.map((g) => ({ ...g })) },
    },
  }
}
