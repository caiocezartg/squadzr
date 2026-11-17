import { useState } from 'react'

interface ReadyEntranceInput {
  /** The Squad the Lobby shows. */
  readonly squadCode: string
  /** The socket has delivered a snapshot. A cached one the Lobby started from does not count: nobody watched it. */
  readonly hasLiveSnapshot: boolean
  readonly isReady: boolean
  /** The viewer is looking at the Squad from outside it: the non-member view. */
  readonly isOutside: boolean
}

/**
 * Whether the invite panel enters with its Ready motion. It does when the viewer watched the Squad become
 * Ready, in either of two ways: a live snapshot said it was not Ready and a later one says it is, or the viewer
 * looked at it from outside in this session and joined, so the first snapshot they get is already Ready
 * (their join closed the last slot). A Squad that is Ready in the first snapshot of a viewer who was
 * already in it, as on a reload or a cold open, is the room as it was: its panel is there without the
 * entrance. A Squad that was Ready when the viewer came back to a cached Lobby is not new either: content from a warm
 * cache does not animate. A reset of the channel (no live snapshot) forgets what was watched forming.
 */
export function useReadyEntrance({
  squadCode,
  hasLiveSnapshot,
  isReady,
  isOutside,
}: ReadyEntranceInput): boolean {
  const [watchedForming, setWatchedForming] = useState(false)
  // The Squad the viewer last looked at from outside. A join turns that view into the member Lobby.
  const [outsideCode, setOutsideCode] = useState<string | null>(null)

  if (hasLiveSnapshot && !isReady && !watchedForming) setWatchedForming(true)
  if (!hasLiveSnapshot && watchedForming) setWatchedForming(false)
  if (isOutside && outsideCode !== squadCode) setOutsideCode(squadCode)

  const joinedHere = !isOutside && outsideCode === squadCode
  return isReady && (watchedForming || joinedHere)
}
