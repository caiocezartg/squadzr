import { setRealtimeUpdateNotice } from '@/lib/realtime-update-store'

/**
 * sessionStorage key holding the timestamp (ms) of the last automatic reload
 * this tab performed to chase the server's realtime protocol.
 */
export const REALTIME_RELOAD_ATTEMPT_KEY = 'squadzr:realtime:last-reload'

/** An automatic reload is allowed at most once per tab in this window. */
export const REALTIME_RELOAD_COOLDOWN_MS = 5 * 60 * 1000

/**
 * True when this tab may still reload automatically for a protocol failure,
 * recording the attempt as a side effect. Unless the attempt can be read and
 * written back, bounded retrying cannot be guaranteed, so the safe answer is
 * no: never reload in a loop when storage is unavailable (private browsing,
 * blocked cookies).
 */
function claimReloadAttempt(now: number): boolean {
  try {
    const stored = sessionStorage.getItem(REALTIME_RELOAD_ATTEMPT_KEY)
    const lastAttempt = stored === null ? null : Number(stored)
    if (
      lastAttempt !== null &&
      (!Number.isFinite(lastAttempt) || now - lastAttempt < REALTIME_RELOAD_COOLDOWN_MS)
    ) {
      return false
    }
    sessionStorage.setItem(REALTIME_RELOAD_ATTEMPT_KEY, String(now))
    return true
  } catch {
    return false
  }
}

/**
 * Reloads so the client fetches the matching build, at most once per cooldown
 * window per tab. A divergence that repeats inside the window (a server
 * announcing another version persistently, a stale cached page, a repeated bad
 * frame) shows a persistent, accessible notice with a manual reload instead of
 * looping through disconnect/reload cycles.
 */
export function reloadToMatchingBuild(): void {
  if (!claimReloadAttempt(Date.now())) {
    setRealtimeUpdateNotice('manual')
    return
  }

  setRealtimeUpdateNotice('reloading')
  window.location.reload()
}
