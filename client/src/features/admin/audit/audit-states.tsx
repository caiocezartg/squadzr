'use client'

import { FileText, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'

/** The audit's loading state, only for a page nobody read before: the rows' places, as bars. */
export function AuditSkeleton() {
  const t = useTranslations('admin.audit')

  return (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-2">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} aria-hidden="true" className="bg-card h-11 animate-pulse" />
      ))}
    </div>
  )
}

interface AuditEmptyProps {
  readonly title: string
  readonly description?: string
  readonly action?: { readonly label: string; readonly onClick: () => void }
}

/** No entry to show: the audit is empty, or the page asked for lies past its end. */
export function AuditEmpty({ title, description, action }: AuditEmptyProps) {
  return (
    <div className="bg-panel flex flex-col items-center gap-3 px-6 py-14 text-center shadow-[inset_0_0_0_1px_var(--color-line)]">
      <span className="bg-line text-muted flex size-13 items-center justify-center">
        <FileText aria-hidden="true" className="size-5.5" strokeWidth={2.2} />
      </span>
      <h2 className="type-panel-title-sm text-text">{title}</h2>
      {description && <p className="type-body text-text-3 max-w-sm">{description}</p>}
      {action && (
        <Button variant="secondary" className="mt-1" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

/** The audit's inline error: what failed, and a button that reads the page again. */
export function AuditLoadError({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('admin.audit')

  return (
    <div className="flex flex-col items-start gap-3">
      <div
        role="alert"
        className="bg-danger-ground text-danger flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold"
      >
        <TriangleAlert aria-hidden="true" className="size-4.5 shrink-0" strokeWidth={2.4} />
        {t('loadError')}
      </div>
      <Button variant="secondary" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  )
}
