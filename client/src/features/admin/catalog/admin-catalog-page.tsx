import { useTranslations } from 'next-intl'
import { AdminPageHeader } from '../shell/admin-page-header'
import { AdminPlaceholder } from '../shell/admin-placeholder'

/** The admin Catalog page. For now it holds its header and a note; its content comes next. */
export function AdminCatalogPage() {
  const t = useTranslations('admin.catalog')

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      <AdminPlaceholder />
    </>
  )
}
