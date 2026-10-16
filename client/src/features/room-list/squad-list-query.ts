import type { Game, PublicRoom } from '@/types'
import type { ResolvedRoomsSearch } from './rooms-search'

export const SQUAD_PAGE_SIZE = 6

/** Past this many pages the page links collapse into first, last and the current neighbours. */
const MAX_LISTED_PAGES = 7

export type SquadListQuery = ResolvedRoomsSearch

export interface SquadListResult {
  /** Every squad that passes the filters, in the requested order. */
  matching: PublicRoom[]
  /** The squads of the current page. */
  pageRooms: PublicRoom[]
  /** The requested page, clamped into the pages that exist. */
  currentPage: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  /** The page numbers to link to, in order. */
  pageRange: number[]
}

type Games = ReadonlyMap<string, Game>

function matchesSearch(room: PublicRoom, games: Games, search: string): boolean {
  const term = search.toLowerCase()
  return (
    !!games.get(room.gameId)?.name.toLowerCase().includes(term) ||
    room.name.toLowerCase().includes(term)
  )
}

function matchesStatus(room: PublicRoom, filter: SquadListQuery['filter']): boolean {
  const members = room.memberCount ?? 1
  if (filter === 'has-space') return members < room.maxPlayers
  if (filter === 'almost-full') return members >= room.maxPlayers - 1 && members < room.maxPlayers
  return true
}

function matchesTag(room: PublicRoom, tag: string): boolean {
  const term = tag.trim().toLowerCase().replace(/^#/, '')
  return room.tags.some((roomTag) => roomTag.toLowerCase().includes(term))
}

function filterRooms(rooms: readonly PublicRoom[], games: Games, query: SquadListQuery) {
  return rooms.filter(
    (room) =>
      (!query.search.trim() || matchesSearch(room, games, query.search)) &&
      matchesStatus(room, query.filter) &&
      (query.language === 'all' || room.language === query.language) &&
      (!query.tag.trim() || matchesTag(room, query.tag))
  )
}

function sortRooms(rooms: PublicRoom[], sort: SquadListQuery['sort']): PublicRoom[] {
  const direction = sort === 'newest' ? -1 : 1
  return rooms.sort(
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
 * The Squad list: filters the squads by search term, status, language and tag,
 * sorts them by creation date (newest first unless asked otherwise) and cuts
 * the page the query asks for. Pure on purpose: the same inputs give the same
 * list on the server render and in the browser, and `rooms` is never mutated.
 * A page past the last one resolves to the last.
 */
export function querySquadList(
  rooms: readonly PublicRoom[],
  games: Games,
  query: SquadListQuery,
  pageSize = SQUAD_PAGE_SIZE
): SquadListResult {
  const matching = sortRooms(filterRooms(rooms, games, query), query.sort)
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize))
  const currentPage = Math.min(query.page, totalPages)
  const start = (currentPage - 1) * pageSize

  return {
    matching,
    pageRooms: matching.slice(start, start + pageSize),
    currentPage,
    totalPages,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    pageRange: listPages(currentPage, totalPages),
  }
}
