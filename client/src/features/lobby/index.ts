/**
 * Public interface of the lobby capability: the command that refreshes a Squad's details after the
 * viewer's Membership changes. The App Router page (see `page`) renders `LobbyPage` with the Squad code;
 * queries, the realtime channel, Presence, Membership commands, board-cache mutations and local state stay
 * internal. The page is not exported here, so joining a Squad can reach the command without pulling the
 * Lobby back in.
 */
export { useSquadDetailsCommands, type SquadDetailsCommands } from './squad-details-cache'
