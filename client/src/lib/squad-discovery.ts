import type { Game, PublicRecruitingSquad } from '@squadzr/types'

export type SquadDiscoveryFilters = {
  search?: string
  language?: 'all' | 'pt-br' | 'en'
  tag?: string
  capacity?: 'all' | 'almost-full'
  sort?: 'newest' | 'expires-soon'
}

export function filterRecruitingSquads(
  squads: readonly PublicRecruitingSquad[],
  games: ReadonlyMap<string, Game>,
  filters: SquadDiscoveryFilters
): PublicRecruitingSquad[] {
  const query = filters.search?.trim().toLowerCase() ?? ''
  const tag = filters.tag?.trim().toLowerCase().replace(/^#/, '') ?? ''

  return squads
    .filter((squad) => {
      const game = games.get(squad.gameId)
      const matchesSearch =
        !query ||
        squad.name.toLowerCase().includes(query) ||
        game?.name.toLowerCase().includes(query)
      const matchesLanguage =
        !filters.language || filters.language === 'all' || squad.language === filters.language
      const matchesTag = !tag || squad.tags.some((squadTag) => squadTag.toLowerCase().includes(tag))
      const matchesCapacity =
        filters.capacity !== 'almost-full' || squad.memberCount >= squad.maxMembers - 1
      return matchesSearch && matchesLanguage && matchesTag && matchesCapacity
    })
    .sort((left, right) => {
      if (filters.sort === 'expires-soon') {
        return new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime()
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })
}
