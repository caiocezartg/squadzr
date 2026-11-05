'use client'

import { TriangleAlert, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'

/** The list's loading state, only for a search and page nobody read before: the rows' places. */
export function UsersSkeleton() {
  const t = useTranslations('admin.users')

  return (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-2">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} aria-hidden="true" className="bg-card h-11 animate-pulse" />
      ))}
    </div>
  )
}

interface UsersEmptyProps {
  readonly title: string
  readonly description?: string
  readonly action?: { readonly label: string; readonly onClick: () => void }
}

/** No person to show: nobody signed up, nobody matches the search, or the page lies past the end. */
export function UsersEmpty({ title, description, action }: UsersEmptyProps) {
  return (
    <div className="bg-panel flex flex-col items-center gap-3 px-6 py-14 text-center shadow-[inset_0_0_0_1px_var(--color-line)]">
      <span className="bg-line text-muted flex size-13 items-center justify-center">
        <Users aria-hidden="true" className="size-5.5" strokeWidth={2.2} />
      </span>
      <h2 className="type-panel-title-sm text-text break-words">{title}</h2>
      {description && <p className="type-body text-text-3 max-w-sm">{description}</p>}
      {action && (
        <Button variant="secondary" className="mt-1" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

/** An inline error: what failed, and a button that reads it again. */
export function UsersLoadError({
  message,
  onRetry,
}: {
  readonly message: string
  readonly onRetry: () => void
}) {
  const t = useTranslations('admin.users')

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
