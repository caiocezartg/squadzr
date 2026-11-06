import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { ADMIN_USERS_HREF } from './user-links'

/**
 * The header of a person's page: the "Admin · Users" caption, the title and the way back to the list.
 * The title is the person's name, or what the page holds instead of them (loading, not found).
 */
export function UserPageHeader({ title }: { readonly title: string }) {
  const t = useTranslations('admin.users.detail')

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <p className="type-label text-muted">{t('caption')}</p>
        <h1 className="type-page-title text-[44px] break-words sm:text-[52px]">{title}</h1>
      </div>
      <Button
        href={ADMIN_USERS_HREF}
        variant="ghost"
        size="sm"
        icon={<ArrowLeft />}
        className="shadow-[inset_0_0_0_1px_var(--color-line)]"
      >
        {t('back')}
      </Button>
    </header>
  )
}
