import 'server-only'

/**
 * The My Squads server entry point, for the app layout that reads the viewer's squads for the sidebar.
 * It stays apart from the `index` entry, which carries client hooks: a server module that imports a
 * client module puts it in the client JavaScript of every route below it.
 */
export { prefetchMySquadsAndWait } from './prefetch-my-squads'
