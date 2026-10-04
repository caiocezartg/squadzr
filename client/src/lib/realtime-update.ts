import i18n from '@/lib/i18n'

export const REALTIME_UPDATE_NOTICE_ID = 'realtime-update-notice'

/**
 * Short notice shown while the page reloads into the build that matches the
 * server's realtime protocol.
 */
export function showRealtimeUpdateNotice(): void {
  if (document.getElementById(REALTIME_UPDATE_NOTICE_ID)) return

  const notice = document.createElement('div')
  notice.id = REALTIME_UPDATE_NOTICE_ID
  notice.setAttribute('role', 'status')
  notice.className =
    'fixed inset-x-0 top-0 z-[100] border-b border-border bg-surface px-4 py-2 text-center text-sm text-offwhite'
  notice.textContent = i18n.t('realtime.updating')
  document.body.appendChild(notice)
}

/** Shows the notice and reloads so the client fetches the matching build. */
export function reloadToMatchingBuild(): void {
  showRealtimeUpdateNotice()
  window.location.reload()
}
