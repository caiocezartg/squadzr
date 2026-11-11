import { normalizeSearchText } from '@squadzr/schemas'
import type { PublicSquad } from '@/types'
import { hasEveryTag } from './squad-tags'
import type { ResolvedSquadsSearch } from './squads-search'

const SQUAD_PAGE_SIZE = 6

export type SquadListQuery = ResolvedSquadsSearch

export interface SquadListResult {
  /** Every squad that passes the filters, in the requested order. */
  matching: PublicSquad[]
  /** The squads of the current page. */
  pageSquads: PublicSquad[]
  /** The requested page, clamped into the pages that exist. */
  currentPage: number
  totalPages: number
}

/**
 * Matches like Game Search: accents, case and punctuation do not matter, so "pokemon" finds
 * "Pokémon Go", "counter strike" finds "Counter-Strike 2" and "lol" finds League of Legends
 * through its alias. The game's aliases arrive already normalized, as the catalog stores them,
 * so only the term and the names are folded here. A term made only of punctuation folds to
 * nothing and, like an empty field, keeps every squad.
 */
function matchesSearch(squad: PublicSquad, search: string): boolean {
  const term = normalizeSearchText(search)
  if (term === '') return true
  return (
    normalizeSearchText(squad.game.name).includes(term) ||
    squad.game.aliases.some((alias) => alias.includes(term)) ||
    normalizeSearchText(squad.name).includes(term)
  )
}

function matchesStatus(squad: PublicSquad, filter: SquadListQuery['filter']): boolean {
  const members = squad.memberCount ?? 1
  if (filter === 'has-space') return members < squad.maxPlayers
  if (filter === 'almost-full') return members >= squad.maxPlayers - 1 && members < squad.maxPlayers
  return true
}

function filterSquads(squads: readonly PublicSquad[], query: SquadListQuery) {
  return squads.filter(
    (squad) =>
      (!query.search.trim() || matchesSearch(squad, query.search)) &&
      matchesStatus(squad, query.filter) &&
      (query.language === 'all' || squad.language === query.language) &&
      // A Squad without a platform drops out once a platform is asked for.
      (query.platform === 'all' || squad.platform === query.platform) &&
      hasEveryTag(squad, query.tag)
  )
}

function sortSquads(squads: PublicSquad[], sort: SquadListQuery['sort']): PublicSquad[] {
  const direction = sort === 'newest' ? -1 : 1
  return squads.sort(
    (a, b) => direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  )
}

/**
 * The Squad list: filters the squads by search term (the Squad's name, or its own game's name or aliases),
 * status, language, platform and tags (a Squad needs every selected tag), sorts them by creation date (newest first unless asked otherwise) and
 * cuts the page the query asks for. Pure on purpose: the same inputs give the same list on the
 * server render and in the browser, and `squads` is never mutated. A page past the last one resolves
 * to the last.
 */
export function querySquadList(
  squads: readonly PublicSquad[],
  query: SquadListQuery,
  pageSize = SQUAD_PAGE_SIZE
): SquadListResult {
  const matching = sortSquads(filterSquads(squads, query), query.sort)
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize))
  const currentPage = Math.min(query.page, totalPages)
  const start = (currentPage - 1) * pageSize

  return {
    matching,
    pageSquads: matching.slice(start, start + pageSize),
    currentPage,
    totalPages,
  }
}
