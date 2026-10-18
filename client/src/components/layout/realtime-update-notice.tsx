'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import {
  getRealtimeUpdateNotice,
  getServerRealtimeUpdateNotice,
  subscribeToRealtimeUpdateNotice,
  type RealtimeUpdateNoticeState,
} from '@/lib/realtime-update-store'

const NOTICE_CLASS =
  'fixed inset-x-0 top-0 z-100 border-b border-border bg-surface px-4 py-2 text-center text-sm text-offwhite'

/**
 * The realtime update notice, mounted in the root layout. It renders the store that the WebSocket's
 * protocol-mismatch path writes to: a transient status while the page reloads, or a persistent alert
 * with a reload button once the automatic reload is no longer allowed.
 */
export function RealtimeUpdateNotice() {
  const notice = useSyncExternalStore(
    subscribeToRealtimeUpdateNotice,
    getRealtimeUpdateNotice,
    getServerRealtimeUpdateNotice
  )

  // The server never renders a notice, so the translator is read only once one shows.
  if (notice === null) return null

  return <UpdateNoticeMessage notice={notice} />
}

function UpdateNoticeMessage({
  notice,
}: {
  readonly notice: Exclude<RealtimeUpdateNoticeState, null>
}) {
  const t = useTranslations()

  if (notice === 'reloading') {
    return (
      <div role="status" className={NOTICE_CLASS}>
        {t('realtime.updating')}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={`${NOTICE_CLASS} flex flex-wrap items-center justify-center gap-3`}
    >
      <span>{t('realtime.updateRequired')}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md border border-border-light bg-surface px-3 py-1 text-xs font-medium text-offwhite transition-all hover:border-muted/30 hover:bg-surface-hover"
      >
        {t('realtime.reload')}
      </button>
    </div>
  )
}
