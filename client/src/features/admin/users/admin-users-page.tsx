import { useTranslations } from 'next-intl'
import { AdminPageHeader } from '../shell/admin-page-header'
import { AdminPlaceholder } from '../shell/admin-placeholder'

/** The admin Users page. For now it holds its header and a note; its content comes next. */
export function AdminUsersPage() {
  const t = useTranslations('admin.users')

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <AdminPlaceholder />
    </>
  )
}
