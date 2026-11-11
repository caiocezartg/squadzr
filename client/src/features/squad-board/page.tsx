/**
 * Public entry point of the Squad Board page. The App Router page renders `SquadBoardPage` and prefetches
 * the board's data with `prefetchSquadBoard`. The view itself is a client component, so the page
 * entry stays importable from the server route.
 */
export { SquadBoardView as SquadBoardPage } from './squad-board-view'
export { prefetchSquadBoard } from './prefetch-squad-board'
