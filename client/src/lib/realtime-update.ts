import i18n from '@/lib/i18n'

export const REALTIME_UPDATE_NOTICE_ID = 'realtime-update-notice'

/**
 * sessionStorage key holding the timestamp (ms) of the last automatic reload
 * this tab performed to chase the server's realtime protocol.
 */
export const REALTIME_RELOAD_ATTEMPT_KEY = 'squadzr:realtime:last-reload'

/** An automatic reload is allowed at most once per tab in this window. */
export const REALTIME_RELOAD_COOLDOWN_MS = 5 * 60 * 1000

/**
 * Renders the notice, replacing any previous one. The transient mode is shown
 * while the page reloads; the manual mode is a persistent alert with an
 * explicit reload action once the automatic reload is no longer allowed.
 */
function renderNotice(mode: 'reloading' | 'manual'): void {
  document.getElementById(REALTIME_UPDATE_NOTICE_ID)?.remove()

  const notice = document.createElement('div')
  notice.id = REALTIME_UPDATE_NOTICE_ID
  notice.setAttribute('role', mode === 'manual' ? 'alert' : 'status')
  const base =
    'fixed inset-x-0 top-0 z-[100] border-b border-border bg-surface px-4 py-2 text-center text-sm text-offwhite'
  notice.className =
    mode === 'manual' ? `${base} flex flex-wrap items-center justify-center gap-3` : base

  if (mode === 'reloading') {
    notice.textContent = i18n.t('realtime.updating')
    document.body.appendChild(notice)
    return
  }

  const message = document.createElement('span')
  message.textContent = i18n.t('realtime.updateRequired')

  const reloadButton = document.createElement('button')
  reloadButton.type = 'button'
  reloadButton.className =
    'rounded-md border border-border-light bg-surface px-3 py-1 text-xs font-medium text-offwhite transition-all hover:border-muted/30 hover:bg-surface-hover'
  reloadButton.textContent = i18n.t('realtime.reload')
  reloadButton.addEventListener('click', () => window.location.reload())

  notice.append(message, reloadButton)
  document.body.appendChild(notice)
}

/**
 * Short notice shown while the page reloads into the build that matches the
 * server's realtime protocol.
 */
export function showRealtimeUpdateNotice(): void {
  renderNotice('reloading')
}

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
    renderNotice('manual')
    return
  }

  showRealtimeUpdateNotice()
  window.location.reload()
}
