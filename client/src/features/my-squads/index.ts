/**
 * Public interface of the My Squads capability: the viewer's squads for the sidebar, and the command
 * that refreshes them after a Membership change. The query key, the read and the list composition stay
 * internal. The layout starts the server read through the `server` entry.
 */
export { useMySquads } from './use-my-squads'
export { useMySquadsCommands, type MySquadsCommands } from './my-squads-cache'
