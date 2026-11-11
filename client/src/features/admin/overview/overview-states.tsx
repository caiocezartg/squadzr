'use client'

import { TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'

/**
 * The Overview's loading state, only when the cache has never held it: the four tiles and the chart
 * panel, as blocks.
 */
export function OverviewSkeleton() {
  const t = useTranslations('admin.overview')

  return (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-4.5">
      <div aria-hidden="true" className="grid grid-cols-2 gap-px xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-card h-32.5 animate-pulse" />
        ))}
      </div>
      <div aria-hidden="true" className="bg-card h-105 animate-pulse" />
    </div>
  )
}

/** The chart's loading state, only for a metric and period the cache has never held. */
export function ActivitySkeleton() {
  const t = useTranslations('admin.overview.activity')

  return <div role="status" aria-label={t('loading')} className="bg-card h-[270px] animate-pulse" />
}

interface OverviewLoadErrorProps {
  readonly message: string
  readonly onRetry: () => void
}

/** A failed read of the Overview or of a chart: what failed, and a button that reads it again. */
export function OverviewLoadError({ message, onRetry }: OverviewLoadErrorProps) {
  const t = useTranslations('admin.overview')

  return (
    <div className="flex flex-col items-start gap-3">
      <div
        role="alert"
        className="bg-danger-ground text-danger flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold"
      >
        <TriangleAlert aria-hidden="true" className="size-4.5 shrink-0" strokeWidth={2.4} />
        {message}
      </div>
      <Button variant="secondary" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  )
}
