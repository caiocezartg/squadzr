/**
 * Public interface of the Squad Board capability. Other capabilities that
 * change the board after a Membership change (squad creation, squad joining and
 * the live lobby) import the cache commands from here, and the shell takes the board's squad count. The page itself is the
 * `page` entry point, so a command caller never pulls the page back in and
 * closes an import cycle. Query keys and cache mutations stay internal.
 */
export { useSquadBoardCommands, type SquadBoardCommands } from './squad-board-cache'
export { OpenSquadCount } from './open-squad-count'
