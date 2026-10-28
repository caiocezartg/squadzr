import { useState } from 'react'

/**
 * Whether the invite panel enters with its Ready motion. It does when the viewer watched the Squad form
 * (a snapshot said it was not Ready) and a later snapshot says it is. A Squad that is Ready in the first
 * snapshot, as on a reload, is the room as it was: its panel is there without the entrance. A reset of
 * the channel (a snapshot that goes away) forgets what was watched.
 */
export function useReadyEntrance(hasSnapshot: boolean, isReady: boolean): boolean {
  const [watchedForming, setWatchedForming] = useState(false)

  if (hasSnapshot && !isReady && !watchedForming) setWatchedForming(true)
  if (!hasSnapshot && watchedForming) setWatchedForming(false)

  return isReady && watchedForming
}
