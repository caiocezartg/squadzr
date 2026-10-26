/**
 * The Squad Board's server entry point, for a layout that needs the board's list but not the board.
 * It stays apart from the `page` entry, which carries the board's client view: a server module that
 * imports a client module puts it in the client JavaScript of every route below it.
 */
export { prefetchSquadBoardAndWait } from './prefetch-squad-board'
