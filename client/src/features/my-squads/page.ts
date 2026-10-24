/**
 * Public entry point of the My Squads page. The App Router page renders `MySquadsPage` and starts
 * the list read with `prefetchMySquads`. The view itself is a client component, so the
 * page entry stays importable from the server route; the server-only read stays behind it.
 */
export { MySquadsView as MySquadsPage } from './my-squads-view'
export { prefetchMySquads } from './prefetch-my-squads'
