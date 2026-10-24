import type { PublicSquad } from '@/types'
import type { ResolvedSquadsSearch } from './squads-search'

const SQUAD_PAGE_SIZE = 6

/** Past this many pages the page links collapse into first, last and the current neighbours. */
const MAX_LISTED_PAGES = 7

export type SquadListQuery = ResolvedSquadsSearch

export interface SquadListResult {
  /** Every squad that passes the filters, in the requested order. */
  matching: PublicSquad[]
  /** The squads of the current page. */
  pageSquads: PublicSquad[]
  /** The requested page, clamped into the pages that exist. */
  currentPage: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  /** The page numbers to link to, in order. */
  pageRange: number[]
}

function matchesSearch(squad: PublicSquad, search: string): boolean {
  const term = search.toLowerCase()
  return squad.game.name.toLowerCase().includes(term) || squad.name.toLowerCase().includes(term)
}

function matchesStatus(squad: PublicSquad, filter: SquadListQuery['filter']): boolean {
  const members = squad.memberCount ?? 1
  if (filter === 'has-space') return members < squad.maxPlayers
  if (filter === 'almost-full') return members >= squad.maxPlayers - 1 && members < squad.maxPlayers
  return true
}

function matchesTag(squad: PublicSquad, tag: string): boolean {
  const term = tag.trim().toLowerCase().replace(/^#/, '')
  return squad.tags.some((squadTag) => squadTag.toLowerCase().includes(term))
}

function filterSquads(squads: readonly PublicSquad[], query: SquadListQuery) {
  return squads.filter(
    (squad) =>
      (!query.search.trim() || matchesSearch(squad, query.search)) &&
      matchesStatus(squad, query.filter) &&
      (query.language === 'all' || squad.language === query.language) &&
      (!query.tag.trim() || matchesTag(squad, query.tag))
  )
}

function sortSquads(squads: PublicSquad[], sort: SquadListQuery['sort']): PublicSquad[] {
  const direction = sort === 'newest' ? -1 : 1
  return squads.sort(
    (a, b) => direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  )
}

/** All pages up to seven; otherwise the first, the last and the current page with its neighbours. */
function listPages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= MAX_LISTED_PAGES) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  const pages = new Set([1, totalPages, currentPage])
  if (currentPage > 1) pages.add(currentPage - 1)
  if (currentPage < totalPages) pages.add(currentPage + 1)
  return [...pages].sort((a, b) => a - b)
}

/**
 * The Squad list: filters the squads by search term (the Squad's name or its own game's name),
 * status, language and tag, sorts them by creation date (newest first unless asked otherwise) and
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
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    pageRange: listPages(currentPage, totalPages),
  }
}
