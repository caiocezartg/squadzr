import { useTranslations } from 'next-intl'
import { AdminPageHeader } from '../shell/admin-page-header'
import { AdminPlaceholder } from '../shell/admin-placeholder'

/** The admin Overview page. For now it holds its header and a note; its content comes next. */
export function AdminOverviewPage() {
  const t = useTranslations('admin.overview')

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <AdminPlaceholder />
    </>
  )
}
