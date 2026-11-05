import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'

interface AdminPageHeaderProps {
  readonly title: string
  /** The one-line description under the title, in `muted`. */
  readonly description: string
  /** Controls at the right of the title row, such as a period switch. */
  readonly actions?: ReactNode
}

/**
 * The header of an admin page (reference, Admin panel): the mono "Admin" caption, a 52px Big Shoulders
 * title (44px below 640px) and its description.
 */
export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  const t = useTranslations('admin')

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <p className="type-label text-muted">{t('caption')}</p>
        <h1 className="type-page-title text-[44px] break-words sm:text-[52px]">{title}</h1>
        <p className="text-muted mt-1.5 text-sm font-medium">{description}</p>
      </div>
      {actions}
    </header>
  )
}
