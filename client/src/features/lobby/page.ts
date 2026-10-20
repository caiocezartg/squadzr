/**
 * Public entry point of the Lobby's App Router page. The page renders `LobbyPage`, starts the Squad's read
 * with `prefetchLobby` and builds the invite preview with `lobbyMetadata`. The server-only reads stay behind
 * this entry, which only the page imports.
 */
export { LobbyPage, type LobbyPageProps } from './lobby-page'
export { prefetchLobby } from './prefetch-lobby'
export { lobbyMetadata } from './lobby-metadata'
