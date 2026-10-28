/**
 * The light public entry of the squad joining capability: the join request alone. The Lobby of a Squad the
 * viewer is not in joins it through this entry, so it does not pull the board's sign-in prompt (the
 * barrel's dialog) into the Lobby's initial JavaScript.
 */
export { useJoinSquad } from './use-join-squad'
