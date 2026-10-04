/**
 * Public interface of the lobby capability. The route entry point renders
 * `LobbyPage` with the room code; queries, the realtime channel, Presence,
 * Membership commands, catalog-cache mutations and local state stay internal.
 */
export { LobbyPage, type LobbyPageProps } from './lobby-page'
