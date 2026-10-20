/**
 * Public interface of the shared squad list capability. The Squad Board and My
 * Squads render the same squad grid, squad card and filter bar and validate the
 * same URL search contract behind these exports. The list query, the URL debounce
 * and the card's cover behavior stay internal. The URL access is the caller's:
 * each route passes the search it reads and writes, so the list does not know the
 * router. Callers that need a different list composition build it from `SquadCard`
 * rather than copying it.
 */
export { SquadCard, type SquadCardProps } from './squad-card'
export { SquadGrid, type SquadGridProps } from './squad-grid'
export { SquadFilters } from './squad-filters'
export { squadsSearchQuery, squadsSearchSchema, type SquadsSearch } from './squads-search'
export { querySquadList, type SquadListQuery, type SquadListResult } from './squad-list-query'
export { useSquadFilters, type SquadSearchAccess } from './use-squad-filters'
