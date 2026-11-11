/**
 * Public interface of the My Squads capability: the viewer's squads for the sidebar, the command that
 * refreshes them after the viewer's own Membership change, and the realtime events that refresh them
 * after anyone else's. The query key, the read and the list composition stay
 * internal. The layout starts the server read through the `server` entry.
 */
export { useMySquads } from './use-my-squads'
export { useMySquadsCommands, type MySquadsCommands } from './my-squads-cache'
export { useMySquadsEvents } from './use-my-squads-events'
