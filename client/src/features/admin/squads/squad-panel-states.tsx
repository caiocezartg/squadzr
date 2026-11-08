'use client'

import { TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'

/** The panel body before the detail lands: the facts' and the members' places. */
export function SquadPanelSkeleton() {
  const t = useTranslations('admin.squads.panel')

  return (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-6">
      <div aria-hidden="true" className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-raised h-10 animate-pulse" />
        ))}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-raised h-10 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

/** The Squad closed or left Open after the list was read: there is nothing left to look at. */
export function SquadPanelGone({ onClose }: { readonly onClose: () => void }) {
  const t = useTranslations('admin.squads.panel')

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="type-panel-title-sm text-text">{t('gone.title')}</p>
      <p className="type-body text-text-3">{t('gone.description')}</p>
      <Button variant="secondary" onClick={onClose}>
        {t('gone.action')}
      </Button>
    </div>
  )
}

/** The detail read failed: what failed, and a button that reads it again. */
export function SquadPanelError({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('admin.squads')

  return (
    <div className="flex flex-col items-start gap-3">
      <div
        role="alert"
        className="bg-danger-ground text-danger flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold"
      >
        <TriangleAlert aria-hidden="true" className="size-4.5 shrink-0" strokeWidth={2.4} />
        {t('panel.loadError')}
      </div>
      <Button variant="secondary" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  )
}
