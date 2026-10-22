/**
 * Public interface of the lobby capability. The App Router page (see `page`)
 * renders `LobbyPage` with the Squad code; queries, the realtime channel,
 * Presence, Membership commands, board-cache mutations and local state stay
 * internal.
 */
export { LobbyPage, type LobbyPageProps } from './lobby-page'
