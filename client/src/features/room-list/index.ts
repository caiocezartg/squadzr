/**
 * Public interface of the shared room list capability. The catalog and My
 * Rooms render the same room card and filter bar and validate the same URL
 * search contract behind these exports; the filter reducer, URL debounce and
 * the card's entrance/cover behavior stay internal. Callers that need a
 * different list composition build it from `RoomCard` rather than copying it.
 */
export { RoomCard, type RoomCardProps } from './room-card'
export { RoomFilters } from './room-filters'
export { roomsSearchSchema } from './rooms-search'
export { useRoomFilters } from './use-room-filters'
