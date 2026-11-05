/**
 * Public interface of the Player Profile capability: the launcher the app shell mounts once, the link
 * hook that opens a person's profile from a photo or a menu, and the cache key the realtime handlers
 * invalidate. The query, the dialog and its blocks stay internal.
 */
export { PlayerProfileLauncher } from './player-profile-launcher'
export { usePlayerProfileLink, type PlayerProfileLink } from './use-player-profile-link'
export { playerProfileQueryKey } from './player-profile-query'
